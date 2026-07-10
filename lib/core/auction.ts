import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { withLock } from "@/lib/redis"
import { secureSlug } from "@/lib/id"
import { emit, Channels } from "./events"
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors"
import {
  captureFrozenPurchase,
  freeze,
  refund,
  spendAvailable,
  unfreeze,
} from "./wallet"
import { BASE_CURRENCY, serializableTx } from "./ledger"
import { progressMission } from "./gamification"
import { createManualDelivery, NoInventoryError, reserveAndDeliverAuto } from "./delivery"
import { notifyAuctionWon } from "@/lib/telegram/notify"
import { formatToman } from "@/lib/format"
import { recordAuctionEvent } from "./auction/events"
import { computeWinnerFromStandings } from "./auction/winner"
import { getAuctionPolicy } from "./auction/policy"
import { assertBuyNowAllowed } from "./auction/pricing"

type Tx = Prisma.TransactionClient

function lockKey(auctionId: string) {
  return `lock:auction:${auctionId}`
}

/** Net amount currently frozen by a user for a specific auction (from ledger). */
async function currentAuctionFrozen(
  userId: string,
  auctionId: string,
  tx: Tx,
): Promise<bigint> {
  const wallet = await tx.wallet.findUnique({
    where: { userId_currency: { userId, currency: BASE_CURRENCY } },
  })
  if (!wallet) return 0n
  const [frozen, unfrozen, captured] = await Promise.all([
    tx.walletTransaction.aggregate({
      _sum: { amount: true },
      where: { walletId: wallet.id, refType: "auction", refId: auctionId, type: "FREEZE" },
    }),
    tx.walletTransaction.aggregate({
      _sum: { amount: true },
      where: { walletId: wallet.id, refType: "auction", refId: auctionId, type: "UNFREEZE" },
    }),
    tx.walletTransaction.aggregate({
      _sum: { amount: true },
      where: { walletId: wallet.id, refType: "auction", refId: auctionId, type: "PURCHASE" },
    }),
  ])
  return (
    (frozen._sum.amount ?? 0n) -
    (unfrozen._sum.amount ?? 0n) -
    (captured._sum.amount ?? 0n)
  )
}

/** Drive a user's frozen amount for an auction to an exact target value. */
async function setAuctionFrozen(
  userId: string,
  auctionId: string,
  target: bigint,
  tx: Tx,
): Promise<void> {
  const current = await currentAuctionFrozen(userId, auctionId, tx)
  const delta = target - current
  const ref = { type: "auction", id: auctionId }
  if (delta > 0n) await freeze(userId, delta, tx, ref)
  else if (delta < 0n) await unfreeze(userId, -delta, tx, ref)
}

/** Top-N (userId, maxAmount) standings for an auction, highest first. */
async function standings(auctionId: string, take: number, tx: Tx | typeof prisma) {
  const grouped = await tx.bid.groupBy({
    by: ["userId"],
    where: { auctionId },
    _max: { amount: true },
  })
  return grouped
    .map((g) => ({ userId: g.userId, amount: g._max.amount ?? 0n }))
    .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
    .slice(0, take)
}

async function loadLiveAuction(auctionId: string, tx: Tx) {
  const auction = await tx.auction.findUnique({
    where: { id: auctionId },
    include: { product: true },
  })
  if (!auction) throw new NotFoundError("Auction not found")
  return auction
}

function ensureActive(auction: { startTime: Date; endTime: Date; status: string }) {
  const now = new Date()
  if (auction.status === "CANCELLED") throw new ValidationError("Auction is cancelled")
  if (auction.status === "FINALIZED" || auction.status === "ENDED") {
    throw new ValidationError("Auction has ended")
  }
  if (now < auction.startTime) throw new ValidationError("Auction has not started")
  if (now > auction.endTime) throw new ValidationError("Auction has ended")
}

async function assertUserActive(userId: string, tx: Tx) {
  const user = await tx.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError("User not found")
  if (user.status === "BANNED") throw new ForbiddenError("User is banned")
}

/**
 * Place a bid. Serialized per-auction via distributed lock + serializable
 * transaction. Freezes only the difference vs the bidder's existing hold and
 * releases the bidder pushed out of the winning set. Applies anti-sniping.
 */
export async function placeBid(opts: {
  userId: string
  auctionId: string
  amount: bigint
  maxAmount?: bigint
  isAuto?: boolean
}) {
  return withLock(lockKey(opts.auctionId), async () => {
    return serializableTx(
      async (tx) => {
        const auction = await loadLiveAuction(opts.auctionId, tx)
        ensureActive(auction)
        await assertUserActive(opts.userId, tx)

        const hasBids = (await tx.bid.count({ where: { auctionId: auction.id } })) > 0
        const required = hasBids
          ? auction.currentPrice + auction.minimumIncrement
          : auction.startPrice
        if (opts.amount < required) {
          throw new ValidationError(
            `Bid must be at least ${required.toString()} Toman`,
          )
        }

        // Record the bid.
        await tx.bid.create({
          data: {
            auctionId: auction.id,
            userId: opts.userId,
            amount: opts.amount,
            isAuto: opts.isAuto ?? false,
            maxAmount: opts.maxAmount ?? null,
          },
        })

        // Loyalty: progress the "place a bid" mission (best-effort, in-tx).
        await progressMission(opts.userId, "PLACE_BID", 1, tx).catch(() => {})

        // Update auction price with optimistic version guard.
        const priceUpdate = await tx.auction.updateMany({
          where: { id: auction.id, version: auction.version },
          data: { currentPrice: opts.amount, version: { increment: 1 } },
        })
        if (priceUpdate.count !== 1) {
          throw new ConflictError("Auction changed concurrently, retry")
        }

        // Bring the bidder's hold up to their new bid (freeze the difference).
        await setAuctionFrozen(opts.userId, auction.id, opts.amount, tx)

        // Release whoever is now just outside the winning set.
        const winners = await standings(auction.id, auction.quantity, tx)
        const winnerIds = new Set(winners.map((w) => w.userId))
        const boundary = await standings(auction.id, auction.quantity + 1, tx)
        const displaced = boundary[auction.quantity]
        let displacedUserId: string | null = null
        if (displaced && !winnerIds.has(displaced.userId)) {
          await setAuctionFrozen(displaced.userId, auction.id, 0n, tx)
          // Don't notify the bidder about outbidding themselves.
          if (displaced.userId !== opts.userId) displacedUserId = displaced.userId
        }

        // Anti-sniping: extend the auction if the bid lands in the final window.
        let endTime = auction.endTime
        let extended = false
        if (auction.antiSnipingEnabled && auction.autoExtend) {
          const remainingMs = auction.endTime.getTime() - Date.now()
          if (remainingMs <= auction.antiSnipingSeconds * 1000) {
            endTime = new Date(auction.endTime.getTime() + auction.antiSnipingSeconds * 1000)
            extended = true
            await tx.auction.update({
              where: { id: auction.id },
              data: { endTime, softCloseExtensions: { increment: 1 } },
            })
          }
        }

        // Timeline (Phase 16): record the bid, any outbid, and any extension.
        // In-tx so the timeline commits atomically with the bid.
        await recordAuctionEvent(
          { auctionId: auction.id, type: "BID_PLACED", userId: opts.userId, amount: opts.amount },
          tx,
        )
        if (displacedUserId) {
          await recordAuctionEvent(
            { auctionId: auction.id, type: "USER_OUTBID", userId: displacedUserId, amount: opts.amount },
            tx,
          )
        }
        if (extended) {
          await recordAuctionEvent(
            {
              auctionId: auction.id,
              type: "AUCTION_EXTENDED",
              amount: null,
              meta: { extensionSeconds: auction.antiSnipingSeconds, endTime: endTime.toISOString() },
            },
            tx,
          )
        }

        const bidderAlias = (await tx.user.findUnique({ where: { id: opts.userId } }))!.alias
        const product = await tx.product.findUnique({
          where: { id: auction.productId },
          select: { title: true },
        })

        return {
          auctionId: auction.id,
          amount: opts.amount,
          endTime,
          bidderAlias,
          displacedUserId,
          productTitle: product?.title ?? "محصول",
        }
      },
      { label: "auctionTx" },
    )
  }).then(async (result) => {
    await emit(Channels.auction(result.auctionId), {
      type: "BID_PLACED",
      auctionId: result.auctionId,
      amount: result.amount.toString(),
      bidderAlias: result.bidderAlias,
      endTime: result.endTime.toISOString(),
    })
    // Notify the displaced bidder that they've been outbid (best-effort).
    if (result.displacedUserId) {
      const { createNotification } = await import("./notifications")
      const { sendAuctionOutbidEmail } = await import("@/lib/email")
      await createNotification({
        userId: result.displacedUserId,
        type: "AUCTION_OUTBID",
        title: "پیشنهاد شما رد شد",
        body: `شخص دیگری در مزایده «${result.productTitle}» پیشنهاد بالاتری ثبت کرد. برای بازگشت به جمع برندگان پیشنهاد جدید بدهید.`,
        href: `/auctions/${result.auctionId}`,
      }).catch(() => {})
      await sendAuctionOutbidEmail({
        userId: result.displacedUserId,
        auctionId: result.auctionId,
        title: result.productTitle,
        // The displacing bid amount uniquely identifies this outbid event.
        bidId: `${result.displacedUserId}:${result.amount.toString()}`,
      })
    }
    return result
  })
}

/** Immediate purchase at the buy-now price; ends the auction. */
export async function buyNow(opts: { userId: string; auctionId: string }) {
  return withLock(lockKey(opts.auctionId), async () => {
    const order = await serializableTx(
      async (tx) => {
        const auction = await loadLiveAuction(opts.auctionId, tx)
        ensureActive(auction)
        await assertUserActive(opts.userId, tx)
        if (!auction.buyNowPrice) throw new ValidationError("Buy-now is not enabled")

        // Smart Buy Now guard (root cause fix, Problem 1): the price charged is
        // recomputed from the live market via the pricing engine, so Buy Now can
        // never settle below the current bid / next valid bid. When the active
        // strategy has withdrawn Buy Now for this state, reject the purchase.
        const policy = await getAuctionPolicy(auction.policyJson, tx)
        const hasBids = (await tx.bid.count({ where: { auctionId: auction.id } })) > 0
        const guard = assertBuyNowAllowed(
          {
            startPrice: auction.startPrice,
            currentPrice: auction.currentPrice,
            hasBids,
            initialBuyNowPrice: auction.buyNowPrice,
            reservePrice: auction.reservePrice ?? null,
          },
          policy,
        )
        if (!guard.allowed || guard.price === null) {
          throw new ValidationError("خرید فوری برای این مزایده در حال حاضر امکان‌پذیر نیست")
        }
        const buyNowCharge = guard.price

        // Release every current frozen holder; the auction is closing now.
        const holders = await standings(auction.id, auction.quantity, tx)
        for (const h of holders) {
          await setAuctionFrozen(h.userId, auction.id, 0n, tx)
        }

        const created = await tx.order.create({
          data: {
            publicId: secureSlug("ord"),
            userId: opts.userId,
            productId: auction.productId,
            auctionId: auction.id,
            type: "BUY_NOW",
            status: "PAID",
            amount: buyNowCharge,
            quantity: 1,
          },
        })

        await spendAvailable(opts.userId, buyNowCharge, tx, {
          type: "order",
          id: created.id,
        })

        await deliverForOrder(created.id, auction.productId, opts.userId, buyNowCharge, tx, auction.product.deliveryType)

        // Winner engine: Buy Now buyer is the authoritative final winner. Store
        // the result explicitly so the UI never infers the winner from bids.
        await tx.auction.update({
          where: { id: auction.id },
          data: {
            status: "FINALIZED",
            finalizedAt: new Date(),
            currentPrice: buyNowCharge,
            winnerUserId: opts.userId,
            finalPrice: buyNowCharge,
            endReason: "BUY_NOW",
          },
        })

        // Timeline: Buy Now completion + winner selection.
        await recordAuctionEvent(
          { auctionId: auction.id, type: "BUY_NOW_COMPLETED", userId: opts.userId, amount: buyNowCharge },
          tx,
        )
        await recordAuctionEvent(
          { auctionId: auction.id, type: "WINNER_SELECTED", userId: opts.userId, amount: buyNowCharge, meta: { endReason: "BUY_NOW" } },
          tx,
        )

        return created
      },
      { label: "auctionTx" },
    )
    await emit(Channels.auction(opts.auctionId), { type: "BUY_NOW", auctionId: opts.auctionId })
    return order
  })
}

/**
 * Deliver an order. AUTOMATIC delivery with no inventory triggers an automatic
 * rollback: the buyer is refunded and the order is marked REFUNDED with a
 * FAILED delivery, instead of failing the whole settlement.
 */
async function deliverForOrder(
  orderId: string,
  productId: string,
  buyerId: string,
  amount: bigint,
  tx: Tx,
  deliveryType: "MANUAL" | "AUTOMATIC",
) {
  if (deliveryType === "MANUAL") {
    await createManualDelivery(orderId, tx)
    return
  }
  try {
    await reserveAndDeliverAuto(orderId, productId, tx)
  } catch (err) {
    if (err instanceof NoInventoryError) {
      // Automatic rollback of the delivery: refund and flag for admin.
      await refund(buyerId, amount, tx, { type: "order", id: orderId })
      await tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } })
      await tx.delivery.create({
        data: {
          orderId,
          method: "AUTOMATIC",
          status: "FAILED",
          error: "No inventory available; payment refunded automatically",
        },
      })
      return
    }
    throw err
  }
}

/**
 * Finalize an ended auction: settle winners (convert frozen -> purchase),
 * release losers, create orders and deliver. Idempotent and safe to call from
 * a cron tick or lazily when the auction is viewed after its end time.
 */
export async function finalizeAuction(auctionId: string) {
  return withLock(lockKey(auctionId), async () => {
    return serializableTx(
      async (tx) => {
        const auction = await loadLiveAuction(auctionId, tx)
        if (auction.status === "FINALIZED" || auction.status === "CANCELLED") {
          return { finalized: false, winners: 0 }
        }
        if (new Date() < auction.endTime) {
          throw new ValidationError("Auction has not ended yet")
        }

        const ranked = await standings(auction.id, auction.quantity, tx)
        const eligible = ranked.filter(
          (r) => !auction.reservePrice || r.amount >= auction.reservePrice,
        )
        const winnerIds = new Set(eligible.map((e) => e.userId))

        // Release frozen funds for everyone who held but did not win.
        const allHolders = await standings(auction.id, auction.quantity + 5, tx)
        for (const h of allHolders) {
          if (!winnerIds.has(h.userId)) {
            await setAuctionFrozen(h.userId, auction.id, 0n, tx)
          }
        }

        // Settle each winner: convert their frozen hold into a purchase.
        for (const w of eligible) {
          await setAuctionFrozen(w.userId, auction.id, w.amount, tx) // normalize hold
          const order = await tx.order.create({
            data: {
              publicId: secureSlug("ord"),
              userId: w.userId,
              productId: auction.productId,
              auctionId: auction.id,
              type: "AUCTION_WIN",
              status: "PAID",
              amount: w.amount,
              quantity: 1,
            },
          })
          await captureFrozenPurchase(w.userId, w.amount, tx, { type: "auction", id: auction.id })
          await deliverForOrder(
            order.id,
            auction.productId,
            w.userId,
            w.amount,
            tx,
            auction.product.deliveryType,
          )
        }

        // Winner engine: resolve the authoritative single-winner spotlight
        // (multi-winner settlement above still credits every eligible bidder).
        // `ranked[0]` is the overall highest bid; the winner engine applies the
        // reserve rule to decide HIGHEST_BID vs RESERVE_NOT_MET.
        const top = ranked[0] ?? null
        const winnerResult = computeWinnerFromStandings({
          topBidderId: top?.userId ?? null,
          topAmount: top?.amount ?? null,
          reservePrice: auction.reservePrice ?? null,
          boughtNow: null,
        })

        await tx.auction.update({
          where: { id: auction.id },
          data: {
            status: "FINALIZED",
            finalizedAt: new Date(),
            winnerUserId: winnerResult.winnerUserId,
            finalPrice: winnerResult.finalPrice,
            endReason: winnerResult.endReason,
          },
        })

        // Timeline: auction ended, then winner / reserve-not-met outcome.
        await recordAuctionEvent({ auctionId: auction.id, type: "AUCTION_ENDED" }, tx)
        if (winnerResult.endReason === "RESERVE_NOT_MET") {
          await recordAuctionEvent(
            { auctionId: auction.id, type: "RESERVE_NOT_MET", amount: top?.amount ?? null },
            tx,
          )
        } else if (winnerResult.winnerUserId) {
          await recordAuctionEvent(
            {
              auctionId: auction.id,
              type: "WINNER_SELECTED",
              userId: winnerResult.winnerUserId,
              amount: winnerResult.finalPrice,
              meta: { endReason: "HIGHEST_BID" },
            },
            tx,
          )
        }

        // Distinct bidders who participated but did not win (for "lost" notices).
        const allBidders = await tx.bid.findMany({
          where: { auctionId: auction.id },
          select: { userId: true },
          distinct: ["userId"],
        })
        const loserIds = allBidders
          .map((b) => b.userId)
          .filter((id) => !winnerIds.has(id))

        return {
          finalized: true,
          winners: eligible.length,
          title: auction.product.title,
          coverImage: auction.product.coverImage,
          winnerList: eligible.map((e) => ({ userId: e.userId, amount: e.amount })),
          loserIds,
        }
      },
      { label: "auctionTx" },
    )
  }).then(async (res) => {
    await emit(Channels.auction(auctionId), { type: "AUCTION_FINALIZED", auctionId })
    // Best-effort Telegram notifications to winners (never blocks settlement).
    if (res.finalized && "winnerList" in res && res.winnerList) {
      const { createNotification } = await import("./notifications")
      const { sendAuctionWinnerEmail } = await import("@/lib/email")
      for (const w of res.winnerList) {
        await notifyAuctionWon(w.userId, res.title!, w.amount, res.coverImage)
        await createNotification({
          userId: w.userId,
          type: "AUCTION_WON",
          title: "برنده مزایده شدید!",
          body: `شما در مزایده «${res.title}» برنده شدید. برای تکمیل خرید اقدام کنید.`,
          href: "/orders",
          image: res.coverImage,
        }).catch(() => {})
        await sendAuctionWinnerEmail({
          userId: w.userId,
          auctionId,
          title: res.title!,
          amount: formatToman(w.amount),
          currency: "IRT",
        })
      }
      // Notify participants who did not win (funds already released above).
      if ("loserIds" in res && res.loserIds) {
        for (const loserId of res.loserIds) {
          await createNotification({
            userId: loserId,
            type: "AUCTION_LOST",
            title: "مزایده به پایان رسید",
            body: `متأسفانه در مزایده «${res.title}» برنده نشدید و مبلغ بلوکه‌شده به کیف پول شما بازگشت. مزایده‌های دیگر را از دست ندهید!`,
            href: "/auctions",
            image: res.coverImage,
          }).catch(() => {})
        }
      }
    }
    return res
  })
}

/**
 * Cancel an auction and release every frozen hold back to bidders. Serialized
 * per-auction and idempotent (a cancelled/finalized auction is left untouched).
 */
export async function cancelAuctionAndRelease(auctionId: string) {
  return withLock(lockKey(auctionId), async () => {
    return serializableTx(
      async (tx) => {
        const auction = await tx.auction.findUnique({ where: { id: auctionId } })
        if (!auction) throw new NotFoundError("مزایده یافت نشد")
        if (auction.status === "FINALIZED") {
          throw new ValidationError("مزایده نهایی‌شده قابل لغو نیست")
        }
        if (auction.status === "CANCELLED") {
          return { cancelled: false, released: 0 }
        }

        // Release every holder still carrying a frozen amount for this auction.
        const holders = await standings(auction.id, auction.quantity + 5, tx)
        let released = 0
        for (const h of holders) {
          const frozen = await currentAuctionFrozen(h.userId, auction.id, tx)
          if (frozen > 0n) {
            await setAuctionFrozen(h.userId, auction.id, 0n, tx)
            released++
          }
        }

        await tx.auction.update({
          where: { id: auction.id },
          data: { status: "CANCELLED", endReason: "CANCELLED" },
        })

        await recordAuctionEvent({ auctionId: auction.id, type: "CANCELLED" }, tx)

        return { cancelled: true, released }
      },
      { label: "auctionTx" },
    )
  }).then(async (res) => {
    await emit(Channels.auction(auctionId), { type: "AUCTION_FINALIZED", auctionId })
    return res
  })
}

/** Finalize all auctions whose end time has passed. For a cron/worker tick. */
export async function tickDueAuctions(): Promise<{ processed: number }> {
  const due = await prisma.auction.findMany({
    where: { status: { in: ["SCHEDULED", "ACTIVE", "ENDED"] }, endTime: { lte: new Date() } },
    select: { id: true },
    take: 100,
  })
  let processed = 0
  for (const a of due) {
    try {
      await finalizeAuction(a.id)
      processed++
    } catch {
      // Skip and let the next tick retry.
    }
  }
  return { processed }
}

/** Activate auctions whose start time has arrived. Returns the activated ids. */
export async function activateDueAuctions(): Promise<{ activated: number; activatedIds: string[] }> {
  const due = await prisma.auction.findMany({
    where: { status: "SCHEDULED", startTime: { lte: new Date() }, endTime: { gt: new Date() } },
    select: { id: true },
    take: 100,
  })
  if (due.length === 0) return { activated: 0, activatedIds: [] }
  const ids = due.map((d) => d.id)
  const res = await prisma.auction.updateMany({
    where: { id: { in: ids }, status: "SCHEDULED" },
    data: { status: "ACTIVE" },
  })
  return { activated: res.count, activatedIds: ids }
}

/**
 * Alert the current leading bidders of auctions ending within `windowMinutes`.
 * Fires once per auction (guarded by endingSoonNotified) so it's safe to call
 * on every cron tick. Returns the number of notifications dispatched.
 */
export async function notifyEndingSoonAuctions(windowMinutes = 10): Promise<{ notified: number }> {
  const now = new Date()
  const threshold = new Date(now.getTime() + windowMinutes * 60_000)
  const soon = await prisma.auction.findMany({
    where: {
      status: "ACTIVE",
      endingSoonNotified: false,
      endTime: { gt: now, lte: threshold },
    },
    include: { product: { select: { title: true, coverImage: true } } },
    take: 50,
  })
  if (soon.length === 0) return { notified: 0 }

  const { createNotification } = await import("./notifications")
  let notified = 0
  for (const auction of soon) {
    // Claim the auction first to avoid duplicate alerts across concurrent ticks.
    const claim = await prisma.auction.updateMany({
      where: { id: auction.id, endingSoonNotified: false },
      data: { endingSoonNotified: true },
    })
    if (claim.count !== 1) continue

    // Notify the users currently in the winning set (they should defend their bid).
    const leaders = await standings(auction.id, auction.quantity, prisma)
    for (const leader of leaders) {
      await createNotification({
        userId: leader.userId,
        type: "AUCTION_ENDING",
        title: "مزایده رو به پایان است",
        body: `مزایده «${auction.product.title}» تا کمتر از ${windowMinutes} دقیقه دیگر به پایان می‌رسد. شما اکنون در جمع برندگان هستید!`,
        href: `/auctions/${auction.id}`,
        image: auction.product.coverImage,
      }).catch(() => {})
      notified++
    }
  }
  return { notified }
}
