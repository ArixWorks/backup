import { prisma } from "@/lib/db"
import { cache } from "@/lib/redis"
import { secureSlug } from "@/lib/id"
import { emit, Channels } from "./events"
import { ConflictError, NotFoundError, ValidationError } from "./errors"
import { spendAvailable } from "./wallet"
import { createManualDelivery, reserveAndDeliverAuto } from "./delivery"
import { evaluateCoupon, redeemCoupon } from "./coupons"
import { applyPurchaseRewards } from "./rewards"
import { getEffectiveTier, tierDiscountPercent } from "./gamification"
import { serializableTx } from "./ledger"

const RESERVATION_TTL_SECONDS = 600 // 10 minutes

/** Bulk-aware pricing for a fixed sale. Shared by card, prompt and purchase. */
export function priceFor(
  sale: { price: bigint; bulkMinQty?: number | null; bulkDiscountPercent?: number | null },
  quantity: number,
): { unitPrice: bigint; totalPrice: bigint; bulkApplied: boolean } {
  const base = sale.price
  let unitPrice = base
  let bulkApplied = false
  if (
    sale.bulkMinQty &&
    sale.bulkDiscountPercent &&
    sale.bulkDiscountPercent > 0 &&
    quantity >= sale.bulkMinQty
  ) {
    unitPrice = base - (base * BigInt(sale.bulkDiscountPercent)) / 100n
    bulkApplied = true
  }
  return { unitPrice, totalPrice: unitPrice * BigInt(quantity), bulkApplied }
}

interface Reservation {
  token: string
  productId: string
  // The chosen sale plan whose stock is held (null for legacy single-plan).
  variantId: string | null
  userId: string
  quantity: number
  expiresAt: string
}

function reservationKey(token: string) {
  return `flashres:${token}`
}

type LoadedVariant = {
  id: string
  price: bigint
  stock: number
  reservedStock: number
  purchaseLimit: number | null
  deliveryType: "MANUAL" | "AUTOMATIC"
  version: number
}

/**
 * Load an active fixed-price product plus the chosen sale plan (variant).
 *
 * Variants are the source of truth for price / stock / delivery / inventory.
 * When `variantId` is omitted we fall back to the product's default plan (every
 * fixed product gets one via the variants migration). If a product has no
 * variants at all (a not-yet-migrated legacy row), `variant` is null and the
 * caller uses the product-level FixedSale as before.
 */
async function loadActiveFixedSale(productId: string, variantId?: string | null) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { fixedSale: true, variants: { where: { active: true }, orderBy: { displayOrder: "asc" } } },
  })
  if (!product || !product.fixedSale || product.saleMode !== "FIXED_PRICE") {
    throw new NotFoundError("Fixed-price product not found")
  }
  if (!product.active || product.hidden) {
    throw new ValidationError("Product is not available")
  }
  const now = new Date()
  const { startTime, endTime } = product.fixedSale
  if (startTime && now < startTime) throw new ValidationError("Sale has not started")
  if (endTime && now > endTime) throw new ValidationError("Sale has ended")

  let variant: LoadedVariant | null = null
  if (product.variants.length > 0) {
    const chosen = variantId
      ? product.variants.find((v) => v.id === variantId)
      : (product.variants.find((v) => v.isDefault) ?? product.variants[0])
    if (!chosen) throw new ValidationError("Selected plan is not available")
    variant = {
      id: chosen.id,
      price: chosen.price,
      stock: chosen.stock,
      reservedStock: chosen.reservedStock,
      purchaseLimit: chosen.purchaseLimit,
      deliveryType: chosen.deliveryType,
      version: chosen.version,
    }
  } else if (variantId) {
    // A plan was requested but the product has none — treat as unavailable.
    throw new ValidationError("Selected plan is not available")
  }

  return { product, variant }
}

async function assertPurchaseLimit(
  userId: string,
  productId: string,
  quantity: number,
  limit: number | null,
  variantId?: string | null,
) {
  if (!limit) return
  // Scope the per-user cap to the chosen plan when the product has variants, so
  // each plan enforces its own limit; otherwise cap across the whole product.
  const agg = await prisma.order.aggregate({
    where: {
      userId,
      ...(variantId ? { variantId } : { productId }),
      type: { in: ["FIXED_PURCHASE", "BUY_NOW"] },
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
    _sum: { quantity: true },
  })
  const already = agg._sum.quantity ?? 0
  if (already + quantity > limit) {
    throw new ValidationError(`Purchase limit reached (max ${limit} per user)`)
  }
}

/**
 * Temporarily hold stock for a user (e.g. while they confirm payment details).
 * Increments reservedStock and stores a Redis token with TTL. If the token is
 * not confirmed before it expires, a worker (or the next purchase) releases it.
 */
export async function reserveFixedSale(
  userId: string,
  productId: string,
  quantity = 1,
  variantId?: string | null,
) {
  if (quantity < 1) throw new ValidationError("Quantity must be at least 1")
  const { product, variant } = await loadActiveFixedSale(productId, variantId)
  const sale = product.fixedSale!
  const stockHolder = variant ?? sale
  await assertPurchaseLimit(userId, productId, quantity, stockHolder.purchaseLimit, variant?.id)

  // Optimistic reservation: only succeed if enough unreserved stock remains.
  // Held on the variant when the product has plans, else on the FixedSale row.
  const updated = variant
    ? await prisma.productVariant.updateMany({
        where: { id: variant.id, version: variant.version, stock: { gte: variant.reservedStock + quantity } },
        data: { reservedStock: { increment: quantity }, version: { increment: 1 } },
      })
    : await prisma.fixedSale.updateMany({
        where: { id: sale.id, version: sale.version, stock: { gte: sale.reservedStock + quantity } },
        data: { reservedStock: { increment: quantity }, version: { increment: 1 } },
      })
  if (updated.count !== 1) {
    throw new ConflictError("Not enough stock to reserve, please retry")
  }

  const token = secureSlug("res")
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000).toISOString()
  const reservation: Reservation = { token, productId, variantId: variant?.id ?? null, userId, quantity, expiresAt }
  await cache.set(reservationKey(token), JSON.stringify(reservation), RESERVATION_TTL_SECONDS)
  return reservation
}

/** Release a temporary reservation, returning the held stock to the pool. */
export async function releaseFixedReservation(token: string) {
  const raw = await cache.get(reservationKey(token))
  if (!raw) return
  const reservation = JSON.parse(raw) as Reservation
  await cache.del(reservationKey(token))
  if (reservation.variantId) {
    await prisma.productVariant.updateMany({
      where: { id: reservation.variantId },
      data: { reservedStock: { decrement: reservation.quantity } },
    })
  } else {
    await prisma.fixedSale.updateMany({
      where: { productId: reservation.productId },
      data: { reservedStock: { decrement: reservation.quantity } },
    })
  }
}

/**
 * Buy a fixed-price product. Charge, stock decrement and (automatic) delivery
 * all happen in a single transaction so a delivery failure rolls everything
 * back: the buyer is never charged and stock is never consumed.
 *
 * If `reservationToken` is provided, the matching temporary hold is consumed.
 */
export async function purchaseFixed(opts: {
  userId: string
  productId: string
  quantity?: number
  variantId?: string | null
  reservationToken?: string
  couponCode?: string
}) {
  const quantity = opts.quantity ?? 1
  if (quantity < 1) throw new ValidationError("Quantity must be at least 1")

  let reservation: Reservation | null = null
  if (opts.reservationToken) {
    const raw = await cache.get(reservationKey(opts.reservationToken))
    if (raw) reservation = JSON.parse(raw) as Reservation
  }

  // Resolve the chosen plan. An explicit variantId wins; otherwise fall back to
  // the reservation's plan (so a held plan is the one actually bought).
  const wantedVariantId = opts.variantId ?? reservation?.variantId ?? null
  const { product, variant } = await loadActiveFixedSale(opts.productId, wantedVariantId)
  const sale = product.fixedSale!
  const stockHolder = variant ?? sale
  const deliveryType = variant ? variant.deliveryType : product.deliveryType
  await assertPurchaseLimit(opts.userId, opts.productId, quantity, stockHolder.purchaseLimit, variant?.id)

  // A reservation only backs this purchase when it matches the resolved plan.
  if (reservation && (reservation.variantId ?? null) !== (variant?.id ?? null)) {
    reservation = null
  }

  // Price comes from the plan; bulk-discount config stays product-level (FixedSale).
  const { totalPrice } = priceFor(
    { price: stockHolder.price, bulkMinQty: sale.bulkMinQty, bulkDiscountPercent: sale.bulkDiscountPercent },
    quantity,
  )

  let rewardSummary: Awaited<ReturnType<typeof applyPurchaseRewards>> | undefined

  // Concurrent purchases are handled with optimistic concurrency + retry rather
  // than a coarse per-product lock. The in-tx stock guard (`updateMany` with
  // `stock >= qty`) makes overselling impossible — losers simply match 0 rows
  // and get a non-retryable "Out of stock". Genuine SERIALIZABLE serialization
  // failures (hot stock row + shared SYS_REVENUE ledger account) are absorbed
  // by serializableTx's full-jitter retry. A lock was tried here but amplified
  // hold time (a holder's own retries could exceed the lock TTL), which starved
  // and failed legitimate buyers while stock remained — retry-only is both
  // simpler and correct, and matches the deposit path which sustains the same
  // 12-way contention.
  const order = await serializableTx(
    async (tx) => {
      // Decrement real stock atomically and bump the sold counter. When a
      // reservation backs this purchase we also release the reserved hold.
      const decrement = reservation
        ? {
            stock: { decrement: quantity },
            reservedStock: { decrement: quantity },
            soldCount: { increment: quantity },
            version: { increment: 1 },
          }
        : { stock: { decrement: quantity }, soldCount: { increment: quantity }, version: { increment: 1 } }

      // Decrement stock on the chosen plan (variant) when the product has
      // plans, else on the product-level FixedSale row (legacy). Same oversell
      // guard: a reservation-backed buy needs held stock; an unbacked buy needs
      // enough non-reserved stock to cover the quantity.
      const stockWhere = reservation
        ? { stock: { gte: quantity }, reservedStock: { gte: quantity } }
        : { stock: { gte: stockHolder.reservedStock + quantity } }
      const stockOk = variant
        ? await tx.productVariant.updateMany({ where: { id: variant.id, ...stockWhere }, data: decrement })
        : await tx.fixedSale.updateMany({ where: { id: sale.id, ...stockWhere }, data: decrement })
      if (stockOk.count !== 1) {
        throw new ConflictError("Out of stock")
      }

      // Evaluate coupon (if any) against the pre-discount total. Throws a
      // ValidationError on any rule violation -> rolls back the whole tx.
      let couponDiscount = 0n
      let couponId: string | null = null
      if (opts.couponCode) {
        const evaluated = await evaluateCoupon(tx, opts.couponCode, totalPrice, opts.userId)
        couponId = evaluated.couponId
        couponDiscount = evaluated.preview.discount
      }

      // Membership-tier discount on the same pre-discount total. The tier
      // discount and the coupon do NOT stack — we apply whichever is larger.
      const effectiveTier = await getEffectiveTier(opts.userId, tx)
      const tierPct = await tierDiscountPercent(effectiveTier, tx)
      const tierDiscount = tierPct > 0 ? (totalPrice * BigInt(tierPct)) / 100n : 0n

      let discount: bigint
      if (tierDiscount >= couponDiscount) {
        // Tier wins (or ties): apply it and DON'T consume the coupon, so the
        // user keeps their coupon for later.
        discount = tierDiscount
        couponId = null
      } else {
        discount = couponDiscount
      }
      const chargeTotal = totalPrice - discount

      const created = await tx.order.create({
        data: {
          publicId: secureSlug("ord"),
          userId: opts.userId,
          productId: opts.productId,
          variantId: variant?.id ?? null,
          type: "FIXED_PURCHASE",
          status: "PAID",
          amount: chargeTotal,
          quantity,
        },
      })

      // Record coupon redemption (increments usage, ties to order).
      if (couponId) {
        await redeemCoupon(tx, couponId, opts.userId, created.id, discount)
      }

      // Charge from available balance (throws if insufficient -> rollback).
      await spendAvailable(opts.userId, chargeTotal, tx, { type: "order", id: created.id })

      // Deliver. For AUTOMATIC, a missing inventory item throws and rolls back
      // the entire transaction (charge + stock) -> automatic rollback.
      if (deliveryType === "AUTOMATIC") {
        await reserveAndDeliverAuto(created.id, product.id, tx, variant?.id)
      } else {
        await createManualDelivery(created.id, tx)
      }

      // Cashback + referral rewards (in-tx -> rolls back on error). The returned
      // summary drives best-effort inviter notifications after the commit.
      rewardSummary = await applyPurchaseRewards(tx, opts.userId, created.id, chargeTotal)

      return created
    },
    { label: "purchaseFixed" },
  )

  if (reservation) await cache.del(reservationKey(reservation.token))

  // Best-effort realtime stock update.
  const fresh = variant
    ? await prisma.productVariant.findUnique({ where: { id: variant.id } })
    : await prisma.fixedSale.findUnique({ where: { id: sale.id } })
  if (fresh) {
    await emit(Channels.broadcast, {
      type: "STOCK_CHANGED",
      productId: product.id,
      stock: fresh.stock - fresh.reservedStock,
    })
    // If this purchase sold out the product, re-arm back-in-stock alerts so
    // subscribers are notified again on the next restock.
    if (fresh.stock - fresh.reservedStock <= 0) {
      try {
        const { reconcileStockAlerts } = await import("./stock-alerts")
        await reconcileStockAlerts(product.id)
      } catch (e) {
        console.log("[v0] reconcileStockAlerts (sellout) error:", (e as Error).message)
      }
    }
  }

  // Best-effort inviter notifications (never block / fail the purchase).
  if (rewardSummary?.firstPurchase || rewardSummary?.commission) {
    try {
      const { notifyReferralPurchase, notifyReferralCommission } = await import("@/lib/telegram/notify")
      if (rewardSummary.firstPurchase) {
        const { referrerId, bonus, friendName } = rewardSummary.firstPurchase
        await notifyReferralPurchase(referrerId, friendName, bonus)
      }
      if (rewardSummary.commission) {
        const { referrerId, amount, friendName } = rewardSummary.commission
        await notifyReferralCommission(referrerId, friendName, amount)
      }
    } catch (e) {
      console.log("[v0] referral notify error:", (e as Error).message)
    }
  }

  // Transactional emails (best-effort, queued — never block the purchase).
  try {
    const { sendPurchaseConfirmationEmail, sendReferralRewardEmail } = await import("@/lib/email")
    const { formatToman } = await import("@/lib/format")
    await sendPurchaseConfirmationEmail({
      userId: order.userId,
      orderId: order.publicId,
      productName: product.title,
      amount: formatToman(order.amount),
      currency: "IRT",
    })
    if (rewardSummary?.commission) {
      const { referrerId, amount } = rewardSummary.commission
      await sendReferralRewardEmail({
        userId: referrerId,
        refId: `${order.id}:commission`,
        amount: formatToman(amount),
        currency: "IRT",
      })
    }
  } catch (e) {
    console.log("[v0] purchase email error:", (e as Error).message)
  }

  // In-app notification (best-effort). AUTOMATIC products are delivered inside
  // the transaction above, so the buyer is told it's ready immediately; MANUAL
  // products get a "processing" note and the delivered notification later fires
  // from the admin fulfilment path (completeManualDelivery).
  try {
    const { createNotification } = await import("./notifications")
    const delivered = deliveryType === "AUTOMATIC"
    await createNotification({
      userId: order.userId,
      type: delivered ? "ORDER_DELIVERED" : "GENERAL",
      title: delivered ? "سفارش تحویل شد" : "خرید ثبت شد",
      body: delivered
        ? `سفارش «${product.title}» با موفقیت خریداری و تحویل داده شد. برای مشاهده کلیک کنید.`
        : `خرید «${product.title}» ثبت شد و در حال آماده‌سازی است. به‌زودی تحویل داده می‌شود.`,
      href: "/orders",
      image: product.coverImage,
    })
  } catch (e) {
    console.log("[v0] purchase notif error:", (e as Error).message)
  }

  return order
}
