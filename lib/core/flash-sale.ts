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
  userId: string
  quantity: number
  expiresAt: string
}

function reservationKey(token: string) {
  return `flashres:${token}`
}

async function loadActiveFixedSale(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { fixedSale: true },
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
  return product
}

async function assertPurchaseLimit(
  userId: string,
  productId: string,
  quantity: number,
  limit: number | null,
) {
  if (!limit) return
  const agg = await prisma.order.aggregate({
    where: {
      userId,
      productId,
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
export async function reserveFixedSale(userId: string, productId: string, quantity = 1) {
  if (quantity < 1) throw new ValidationError("Quantity must be at least 1")
  const product = await loadActiveFixedSale(productId)
  const sale = product.fixedSale!
  await assertPurchaseLimit(userId, productId, quantity, sale.purchaseLimit)

  // Optimistic reservation: only succeed if enough unreserved stock remains.
  const updated = await prisma.fixedSale.updateMany({
    where: {
      id: sale.id,
      version: sale.version,
      stock: { gte: sale.reservedStock + quantity },
    },
    data: { reservedStock: { increment: quantity }, version: { increment: 1 } },
  })
  if (updated.count !== 1) {
    throw new ConflictError("Not enough stock to reserve, please retry")
  }

  const token = secureSlug("res")
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_SECONDS * 1000).toISOString()
  const reservation: Reservation = { token, productId, userId, quantity, expiresAt }
  await cache.set(reservationKey(token), JSON.stringify(reservation), RESERVATION_TTL_SECONDS)
  return reservation
}

/** Release a temporary reservation, returning the held stock to the pool. */
export async function releaseFixedReservation(token: string) {
  const raw = await cache.get(reservationKey(token))
  if (!raw) return
  const reservation = JSON.parse(raw) as Reservation
  await cache.del(reservationKey(token))
  await prisma.fixedSale.updateMany({
    where: { productId: reservation.productId },
    data: { reservedStock: { decrement: reservation.quantity } },
  })
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
  reservationToken?: string
  couponCode?: string
}) {
  const quantity = opts.quantity ?? 1
  if (quantity < 1) throw new ValidationError("Quantity must be at least 1")

  const product = await loadActiveFixedSale(opts.productId)
  const sale = product.fixedSale!
  await assertPurchaseLimit(opts.userId, opts.productId, quantity, sale.purchaseLimit)

  let reservation: Reservation | null = null
  if (opts.reservationToken) {
    const raw = await cache.get(reservationKey(opts.reservationToken))
    if (raw) reservation = JSON.parse(raw) as Reservation
  }

  const { totalPrice } = priceFor(sale, quantity)

  let rewardSummary: Awaited<ReturnType<typeof applyPurchaseRewards>> | undefined

  const order = await prisma.$transaction(
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

      const stockOk = await tx.fixedSale.updateMany({
        where: reservation
          ? { id: sale.id, stock: { gte: quantity }, reservedStock: { gte: quantity } }
          : {
              id: sale.id,
              // available (non-reserved) stock must cover the purchase
              stock: { gte: sale.reservedStock + quantity },
            },
        data: decrement,
      })
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
      if (product.deliveryType === "AUTOMATIC") {
        await reserveAndDeliverAuto(created.id, product.id, tx)
      } else {
        await createManualDelivery(created.id, tx)
      }

      // Cashback + referral rewards (in-tx -> rolls back on error). The returned
      // summary drives best-effort inviter notifications after the commit.
      rewardSummary = await applyPurchaseRewards(tx, opts.userId, created.id, chargeTotal)

      return created
    },
    { isolationLevel: "Serializable" },
  )

  if (reservation) await cache.del(reservationKey(reservation.token))

  // Best-effort realtime stock update.
  const fresh = await prisma.fixedSale.findUnique({ where: { id: sale.id } })
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

  return order
}
