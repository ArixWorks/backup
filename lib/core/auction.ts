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
import { assertBuyNowAllowed, incrementForPrice, nextMinimumBid } from "./auction/pricing"
import { resolveProxyBids, type ProxyAgent } from "./auction/proxy"
import { captureBidSignal, auctionClusterCounts, type BidRiskContext } from "./auction/signals"
import { scoreBidRisk, type BidRiskResult } from "./auction/fraud"
import { computeSoftCloseExtension, computePaymentDeadline, isTerminalStatus } from "./auction/lifecycle"
import {
  computeBidFreezeTarget,
  computeWinnerObligation,
  resolveDefaultAction,
  restrictionDays,
} from "./auction/settlement"
import { audit } from "./audit"

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

/**
 * Build the proxy-agent set for an auction: one entry per bidder with their
 * effective ceiling (highest maxAmount or manual bid), current visible amount,
 * and the time they committed to that ceiling (for eBay-style tie-breaking).
 */
async function loadProxyAgents(auctionId: string, tx: Tx): Promise<ProxyAgent[]> {
  const bids = await tx.bid.findMany({
    where: { auctionId },
    select: { userId: true, amount: true, maxAmount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
  const map = new Map<string, ProxyAgent>()
  for (const b of bids) {
    const ceiling = b.maxAmount && b.maxAmount > b.amount ? b.maxAmount : b.amount
    const existing = map.get(b.userId)
    if (!existing) {
      map.set(b.userId, {
        userId: b.userId,
        ceiling,
        currentAmount: b.amount,
        committedAt: b.createdAt.getTime(),
      })
    } else {
      if (ceiling > existing.ceiling) {
        existing.ceiling = ceiling
        existing.committedAt = b.createdAt.getTime()
      }
      if (b.amount > existing.currentAmount) existing.currentAmount = b.amount
    }
  }
  return [...map.values()]
}

function ensureActive(auction: { startTime: Date; endTime: Date; status: string }) {
  const now = new Date()
  if (auction.status === "CANCELLED") throw new ValidationError("Auction is cancelled")
  // Any terminal state (FINALIZED / SOLD / SETTLED / RESERVE_NOT_MET / …) or an
  // ENDED row blocks new bids — resolved centrally by the lifecycle engine so a
  // Buy-Now-sold auction can never accept a late bid before its end time.
  if (isTerminalStatus(auction.status) || auction.status === "ENDED") {
    throw new ValidationError("Auction has ended")
  }
  if (now < auction.startTime) throw new ValidationError("Auction has not started")
  if (now > auction.endTime) throw new ValidationError("Auction has ended")
}

async function assertUserActive(userId: string, tx: Tx) {
  const user = await tx.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError("User not found")
  if (user.status === "BANNED") throw new ForbiddenError("User is banned")
  // Temporary auction ban from the RESTRICT_USER winner-default action.
  if (user.auctionRestrictedUntil && user.auctionRestrictedUntil > new Date()) {
    throw new ForbiddenError("شما به‌طور موقت از شرکت در مزایده‌ها محروم هستید")
  }
}

/**
 * Place a bid. Serialized per-auction via distributed lock + serializable
 * transaction. Freezes only the difference vs the bidder's existing hold and
 * releases the bidder pushed out of the winning set. Applies anti-sniping.
 */
/**
 * Internal signal used to unwind the bid transaction when the anti-fraud engine
 * blocks a bid. Carries the scored result so the durable BLOCK flag can be
 * persisted OUTSIDE the rolled-back transaction (in the catch handler).
 */
class BidBlockedError extends Error {
  constructor(readonly result: BidRiskResult) {
    super("BID_BLOCKED")
    this.name = "BidBlockedError"
  }
}

export async function placeBid(opts: {
  userId: string
  auctionId: string
  amount: bigint
  maxAmount?: bigint
  isAuto?: boolean
  /** Web request context (hashed for anti-fraud cluster detection, PR6). */
  context?: BidRiskContext
}) {
  try {
    return await withLock(lockKey(opts.auctionId), async () => {
    return serializableTx(
      async (tx) => {
        const auction = await loadLiveAuction(opts.auctionId, tx)
        ensureActive(auction)
        await assertUserActive(opts.userId, tx)

        // Resolve the effective policy once (global + per-auction override), so
        // the tiered increment and soft-close rules the engine enforces here are
        // identical to what the pricing engine advertises to the UI.
        const policy = await getAuctionPolicy(auction.policyJson, tx)

        const hasBids = (await tx.bid.count({ where: { auctionId: auction.id } })) > 0
        // Tiered/fixed minimum next bid comes from the pricing engine — no more
        // flat `minimumIncrement` column arithmetic at the call site (PR3).
        const required = nextMinimumBid(
          { startPrice: auction.startPrice, currentPrice: auction.currentPrice, hasBids },
          policy,
        )
        if (opts.amount < required) {
          throw new ValidationError(
            `Bid must be at least ${required.toString()} Toman`,
          )
        }

        // Proxy / auto-bid ceiling validation (PR5). A max bid is only accepted
        // when the policy enables proxy bidding, on single-item auctions, and it
        // must sit at or above the entered bid.
        if (opts.maxAmount != null) {
          if (!policy.proxyBidEnabled) {
            throw new ValidationError("پیشنهاد خودکار (سقف پیشنهاد) برای این مزایده فعال نیست")
          }
          if (auction.quantity !== 1) {
            throw new ValidationError("پیشنهاد خودکار فقط برای مزایده‌های تک‌واحدی در دسترس است")
          }
          if (opts.maxAmount < opts.amount) {
            throw new ValidationError("سقف پیشنهاد نمی‌تواند کمتر از مبلغ پیشنهاد شما باشد")
          }
        }

        // --- Anti-fraud evaluation (PR6) ---
        // When enabled, capture the bidder's hashed network/device signal and
        // score it against OTHER accounts already bidding on THIS auction. High-
        // confidence multi-account collusion (shared device, or shared IP+UA)
        // blocks the bid; softer signals are flagged for admin review only.
        let fraudResult: BidRiskResult | null = null
        if (policy.auctionAntiFraudEnabled) {
          const sig = await captureBidSignal(auction.id, opts.userId, opts.context, tx)
          const cluster = await auctionClusterCounts(auction.id, opts.userId, sig, tx)
          const bidder = await tx.user.findUnique({
            where: { id: opts.userId },
            select: { createdAt: true },
          })
          const windowStart = new Date(Date.now() - 60_000)
          const recentBidsByUser = await tx.bid.count({
            where: { auctionId: auction.id, userId: opts.userId, createdAt: { gte: windowStart } },
          })
          fraudResult = scoreBidRisk({
            cluster,
            accountAgeMs: bidder ? Date.now() - bidder.createdAt.getTime() : -1,
            recentBidsByUser,
            policyAction: policy.antiFraudDefaultAction,
          })
          if (fraudResult.block) {
            // Roll the whole bid back; the durable BLOCK flag is persisted in the
            // catch handler so it survives the rollback.
            throw new BidBlockedError(fraudResult)
          }
        }

        // Record the incoming (visible) bid at the entered amount. Any ceiling
        // is stored on the row; the proxy engine reads it below.
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

        // Emit the incoming bid on the timeline first (chronological order),
        // before any proxy auto-bids it triggers.
        await recordAuctionEvent(
          { auctionId: auction.id, type: "BID_PLACED", userId: opts.userId, amount: opts.amount },
          tx,
        )

        // Persist a non-blocking anti-fraud flag (PR6) for admin review, atomic
        // with the accepted bid. Only soft/medium signals reach here (blocks
        // throw earlier). score===0 means clean → nothing to record.
        if (fraudResult && fraudResult.score > 0) {
          await tx.auctionRiskFlag.create({
            data: {
              auctionId: auction.id,
              userId: opts.userId,
              score: fraudResult.score,
              reason: fraudResult.reason,
              signals: fraudResult.signals,
              action: fraudResult.action,
              blocked: false,
            },
          })
          await recordAuctionEvent(
            { auctionId: auction.id, type: "RISK_FLAGGED", userId: opts.userId, amount: opts.amount },
            tx,
          )
        }

        // Who was leading before this action, for the outbid notification.
        const prevLeaderId = (await standings(auction.id, 1, tx))[0]?.userId ?? null

        // --- Proxy / auto-bid resolution (PR5) ---
        // Single-item auctions only, when the policy enables proxy bidding. The
        // engine settles the price eBay-style between the top two max-bid agents
        // and emits auto-bids so the visible price + standings reflect it. Multi-
        // winner auctions never use proxy (PR4 forces their full-freeze path).
        const proxyActive = policy.proxyBidEnabled && auction.quantity === 1
        let effectivePrice = opts.amount
        let winnerCeiling =
          opts.maxAmount && opts.maxAmount > opts.amount ? opts.maxAmount : opts.amount
        if (proxyActive) {
          const agents = await loadProxyAgents(auction.id, tx)
          const resolution = resolveProxyBids(agents, auction.startPrice, (p) =>
            incrementForPrice(p, policy),
          )
          if (resolution) {
            for (const ab of resolution.autoBids) {
              await tx.bid.create({
                data: {
                  auctionId: auction.id,
                  userId: ab.userId,
                  amount: ab.amount,
                  isAuto: true,
                  maxAmount: null,
                },
              })
              await recordAuctionEvent(
                { auctionId: auction.id, type: "BID_PLACED", userId: ab.userId, amount: ab.amount },
                tx,
              )
            }
            if (resolution.settlePrice > effectivePrice) effectivePrice = resolution.settlePrice
            winnerCeiling = resolution.leaderCeiling
          }
        }

        // Reserve tracking: emit a single RESERVE_MET event when the effective
        // (post-proxy) price first lifts the auction to/over the reserve.
        const reserveJustMet =
          policy.reservePriceEnabled &&
          auction.reservePrice != null &&
          auction.currentPrice < auction.reservePrice &&
          effectivePrice >= auction.reservePrice

        // Update auction price to the effective (post-proxy) price with an
        // optimistic version guard.
        const priceUpdate = await tx.auction.updateMany({
          where: { id: auction.id, version: auction.version },
          data: { currentPrice: effectivePrice, version: { increment: 1 } },
        })
        if (priceUpdate.count !== 1) {
          throw new ConflictError("Auction changed concurrently, retry")
        }

        // Freeze reconciliation.
        let displacedUserId: string | null = null
        if (proxyActive) {
          // Full-ceiling freeze: the current leader holds a freeze up to their
          // committed ceiling (so the eventual winner is always fully funded —
          // PR4 guarantee), and every other bidder is released. Freezing the
          // leader's ceiling here also enforces that a max bid must be backed by
          // real available funds (insufficient funds rolls the whole bid back).
          const leaderId = (await standings(auction.id, 1, tx))[0]?.userId ?? opts.userId
          const others = await standings(auction.id, 1000, tx)
          for (const o of others) {
            if (o.userId === leaderId) continue
            const frozen = await currentAuctionFrozen(o.userId, auction.id, tx)
            if (frozen > 0n) await setAuctionFrozen(o.userId, auction.id, 0n, tx)
          }
          await setAuctionFrozen(leaderId, auction.id, winnerCeiling, tx)
          if (prevLeaderId && prevLeaderId !== leaderId && prevLeaderId !== opts.userId) {
            displacedUserId = prevLeaderId
          }
        } else {
          // Non-proxy path (unchanged): bring the bidder's hold up to the policy
          // freeze target and release whoever is pushed out of the winning set.
          const freezeTarget = computeBidFreezeTarget({
            bidAmount: opts.amount,
            startPrice: auction.startPrice,
            quantity: auction.quantity,
            policy,
          })
          await setAuctionFrozen(opts.userId, auction.id, freezeTarget, tx)

          const winners = await standings(auction.id, auction.quantity, tx)
          const winnerIds = new Set(winners.map((w) => w.userId))
          const boundary = await standings(auction.id, auction.quantity + 1, tx)
          const displaced = boundary[auction.quantity]
          if (displaced && !winnerIds.has(displaced.userId)) {
            await setAuctionFrozen(displaced.userId, auction.id, 0n, tx)
            // Don't notify the bidder about outbidding themselves.
            if (displaced.userId !== opts.userId) displacedUserId = displaced.userId
          }
        }

        // Soft-close / anti-sniping (PR3): the lifecycle engine decides whether a
        // bid inside the closing window extends the auction, honouring the policy
        // window, the per-extension duration AND the max-extensions cap (so a
        // sniping war can no longer extend an auction indefinitely). The legacy
        // per-auction anti-sniping columns are still respected as a hard toggle:
        // if the row disables anti-sniping, no extension is applied.
        let endTime = auction.endTime
        let extended = false
        const antiSnipeAllowed = auction.antiSnipingEnabled && auction.autoExtend
        const extendedEnd = antiSnipeAllowed
          ? computeSoftCloseExtension(
              { endTime: auction.endTime, softCloseExtensions: auction.softCloseExtensions },
              policy,
            )
          : null
        if (extendedEnd) {
          endTime = extendedEnd
          extended = true
          await tx.auction.update({
            where: { id: auction.id },
            data: { endTime, softCloseExtensions: { increment: 1 } },
          })
        }

        // Timeline (Phase 16): the incoming BID_PLACED (and any proxy auto-bids)
        // were already recorded above; here we add reserve/outbid/extension.
        if (reserveJustMet) {
          await recordAuctionEvent(
            { auctionId: auction.id, type: "RESERVE_MET", userId: opts.userId, amount: effectivePrice },
            tx,
          )
        }
        if (displacedUserId) {
          await recordAuctionEvent(
            { auctionId: auction.id, type: "USER_OUTBID", userId: displacedUserId, amount: effectivePrice },
            tx,
          )
        }
        if (extended) {
          await recordAuctionEvent(
            {
              auctionId: auction.id,
              type: "AUCTION_EXTENDED",
              amount: null,
              meta: {
                extensionSeconds: policy.softCloseExtensionSeconds,
                extensionNumber: auction.softCloseExtensions + 1,
                maxExtensions: policy.maxSoftCloseExtensions,
                endTime: endTime.toISOString(),
              },
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
          amount: effectivePrice,
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
  } catch (e) {
    if (e instanceof BidBlockedError) {
      // Persist a DURABLE block record outside the rolled-back transaction so
      // the attempt is visible to admins and the bidder's signal keeps
      // strengthening cluster detection for repeat attempts. Best-effort.
      const r = e.result
      try {
        await captureBidSignal(opts.auctionId, opts.userId, opts.context, prisma)
        await prisma.auctionRiskFlag.create({
          data: {
            auctionId: opts.auctionId,
            userId: opts.userId,
            score: r.score,
            reason: r.reason,
            signals: r.signals,
            action: r.action,
            blocked: true,
          },
        })
        await recordAuctionEvent(
          { auctionId: opts.auctionId, type: "BID_BLOCKED", userId: opts.userId, amount: opts.amount },
          prisma,
        )
        await audit({
          actorId: opts.userId,
          action: "auction.bid.blocked",
          entity: "auction",
          entityId: opts.auctionId,
          meta: { score: r.score, reason: r.reason, signals: r.signals },
        })
      } catch (err) {
        console.log("[v0] bid-block persist error:", (err as Error).message)
      }
      throw new ValidationError(
        "این پیشنهاد به دلیل شناسایی فعالیت مشکوک (چند حساب مرتبط) مسدود شد. در صورت اشتباه با پشتیبانی تماس بگیرید.",
      )
    }
    throw e
  }
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
        // Lifecycle (PR3): a Buy Now purchase settles immediately (funds spent +
        // delivered in this tx), so the terminal status is SOLD with a BUY_NOW
        // reason. `finalizedAt` still stamps the settlement time.
        await tx.auction.update({
          where: { id: auction.id },
          data: {
            status: "SOLD",
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
        // Idempotency: any terminal state (FINALIZED, SOLD, SETTLED,
        // RESERVE_NOT_MET, CANCELLED, …) means this auction is already settled.
        // Resolved via the lifecycle engine so newly-introduced terminal states
        // can never trigger a second settlement pass.
        if (isTerminalStatus(auction.status)) {
          return { finalized: false, winners: 0 }
        }
        if (new Date() < auction.endTime) {
          throw new ValidationError("Auction has not ended yet")
        }

        // Resolve the effective policy so the freeze target used at settlement
        // matches exactly what was frozen while bidding (single source of truth).
        const policy = await getAuctionPolicy(auction.policyJson, tx)

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

        // Settle each winner. In the DEFAULT full-freeze mode every winner is
        // fully funded (held == bid) and is captured + delivered instantly — the
        // safe, unpaid-winner-proof behaviour, byte-for-byte unchanged. Only an
        // explicit deposit / partial-freeze policy can leave a single winner
        // underfunded, in which case the auction enters PAYMENT_PENDING and the
        // deadline / default / second-chance lifecycle (see auction/payment.ts)
        // takes over. `computeBidFreezeTarget` hard-guarantees full freeze for
        // multi-winner auctions, so at most ONE pending winner is ever possible.
        const settledWinners: { userId: string; amount: bigint }[] = []
        let pendingWinner: { userId: string; amount: bigint; deposit: bigint } | null = null

        for (const w of eligible) {
          const target = computeBidFreezeTarget({
            bidAmount: w.amount,
            startPrice: auction.startPrice,
            quantity: auction.quantity,
            policy,
          })
          await setAuctionFrozen(w.userId, auction.id, target, tx) // normalize hold to policy target
          const obligation = computeWinnerObligation({ finalPrice: w.amount, heldDeposit: target })

          if (obligation.fullyFunded) {
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
            settledWinners.push({ userId: w.userId, amount: w.amount })
          } else {
            // Underfunded winner: keep the deposit frozen, open a PENDING order,
            // and wait for the balance to be paid before the deadline. Nothing is
            // captured or delivered yet.
            await tx.order.create({
              data: {
                publicId: secureSlug("ord"),
                userId: w.userId,
                productId: auction.productId,
                auctionId: auction.id,
                type: "AUCTION_WIN",
                status: "PENDING",
                amount: w.amount,
                quantity: 1,
              },
            })
            pendingWinner = { userId: w.userId, amount: w.amount, deposit: obligation.heldDeposit }
          }
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

        // Lifecycle: map the winner result onto a precise terminal status.
        // - RESERVE_NOT_MET   → ended below reserve, no sale.
        // - underfunded winner → PAYMENT_PENDING (awaiting balance payment).
        // - a funded winner    → SETTLED (funds captured + delivered in this tx).
        // - no bids / no winner → FINALIZED (neutral ended, nothing sold).
        const paymentDeadlineAt = pendingWinner ? computePaymentDeadline(policy) : null
        const terminalStatus =
          winnerResult.endReason === "RESERVE_NOT_MET"
            ? "RESERVE_NOT_MET"
            : pendingWinner
              ? "PAYMENT_PENDING"
              : winnerResult.winnerUserId
                ? "SETTLED"
                : "FINALIZED"

        await tx.auction.update({
          where: { id: auction.id },
          data: {
            status: terminalStatus,
            finalizedAt: new Date(),
            winnerUserId: winnerResult.winnerUserId,
            finalPrice: winnerResult.finalPrice,
            endReason: winnerResult.endReason,
            paymentDeadlineAt,
          },
        })

        // Timeline: auction ended, then winner / reserve-not-met / pending outcome.
        await recordAuctionEvent({ auctionId: auction.id, type: "AUCTION_ENDED" }, tx)
        if (winnerResult.endReason === "RESERVE_NOT_MET") {
          await recordAuctionEvent(
            { auctionId: auction.id, type: "RESERVE_NOT_MET", amount: top?.amount ?? null },
            tx,
          )
        } else if (pendingWinner) {
          await recordAuctionEvent(
            {
              auctionId: auction.id,
              type: "WINNER_SELECTED",
              userId: pendingWinner.userId,
              amount: pendingWinner.amount,
              meta: { endReason: "HIGHEST_BID" },
            },
            tx,
          )
          await recordAuctionEvent(
            {
              auctionId: auction.id,
              type: "PAYMENT_PENDING",
              userId: pendingWinner.userId,
              amount: pendingWinner.amount,
              meta: {
                deposit: pendingWinner.deposit.toString(),
                remaining: (pendingWinner.amount - pendingWinner.deposit).toString(),
                deadlineAt: paymentDeadlineAt?.toISOString() ?? null,
              },
            },
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
          // Settlement completed atomically (funds captured + delivered) → SETTLED.
          await recordAuctionEvent(
            {
              auctionId: auction.id,
              type: "SETTLED",
              userId: winnerResult.winnerUserId,
              amount: winnerResult.finalPrice,
              meta: { winners: settledWinners.length },
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
          winners: settledWinners.length,
          title: auction.product.title,
          coverImage: auction.product.coverImage,
          winnerList: settledWinners,
          pendingWinner: pendingWinner
            ? {
                userId: pendingWinner.userId,
                amount: pendingWinner.amount,
                remaining: pendingWinner.amount - pendingWinner.deposit,
                deadlineAt: paymentDeadlineAt,
              }
            : null,
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
      // Underfunded winner (deposit / partial-freeze mode): prompt to pay the
      // remaining balance before the deadline. Only reachable when an opt-in
      // policy created an unpaid-winner scenario.
      if ("pendingWinner" in res && res.pendingWinner) {
        const { createNotification } = await import("./notifications")
        const pw = res.pendingWinner
        await createNotification({
          userId: pw.userId,
          type: "AUCTION_WON",
          title: "برنده شدید — پرداخت باقی‌مانده",
          body: `شما در مزایده «${res.title}» برنده شدید. برای نهایی‌شدن خرید، مبلغ باقی‌مانده ${formatToman(pw.remaining)} تومان را تا مهلت تعیین‌شده پرداخت کنید.`,
          href: "/orders",
          image: res.coverImage,
        }).catch(() => {})
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
 * Complete a winner's outstanding balance for a PAYMENT_PENDING auction (deposit
 * / partial-freeze mode only). Captures the held deposit + spends the remaining
 * balance from available funds via the Wallet Engine, creates/settles the order,
 * delivers, and moves the auction to SETTLED. Idempotent + serialized.
 *
 * `payerId` is the winner (self-service) OR the second-chance holder once an
 * offer has been accepted — both are validated against the auction row.
 */
export async function payAuctionBalance(opts: { auctionId: string; userId: string }) {
  return withLock(lockKey(opts.auctionId), async () => {
    return serializableTx(
      async (tx) => {
        const auction = await loadLiveAuction(opts.auctionId, tx)
        if (auction.status === "SETTLED") return { paid: false, alreadySettled: true }
        if (auction.status !== "PAYMENT_PENDING") {
          throw new ValidationError("این مزایده در وضعیت انتظار پرداخت نیست")
        }
        // Only the recorded winner may pay (winnerUserId is reassigned when a
        // second-chance offer is accepted, so this covers both cases).
        if (auction.winnerUserId !== opts.userId) {
          throw new ForbiddenError("شما برنده این مزایده نیستید")
        }
        const finalPrice = auction.finalPrice ?? auction.currentPrice
        const held = await currentAuctionFrozen(opts.userId, auction.id, tx)
        const obligation = computeWinnerObligation({ finalPrice, heldDeposit: held })

        // Capture the frozen deposit, then spend the remaining balance from
        // available funds. Both go through the Wallet Engine (no direct math).
        if (obligation.heldDeposit > 0n) {
          await captureFrozenPurchase(opts.userId, obligation.heldDeposit, tx, {
            type: "auction",
            id: auction.id,
          })
        }
        if (obligation.remaining > 0n) {
          await spendAvailable(opts.userId, obligation.remaining, tx, {
            type: "auction",
            id: auction.id,
          })
        }

        // Reuse the PENDING order opened at finalize time; create one only if it
        // is somehow missing (defensive). Never leaves two orders per winner.
        const existing = await tx.order.findFirst({
          where: { auctionId: auction.id, userId: opts.userId, type: "AUCTION_WIN" },
          orderBy: { createdAt: "desc" },
        })
        const order = existing
          ? await tx.order.update({
              where: { id: existing.id },
              data: { status: "PAID", amount: finalPrice },
            })
          : await tx.order.create({
              data: {
                publicId: secureSlug("ord"),
                userId: opts.userId,
                productId: auction.productId,
                auctionId: auction.id,
                type: "AUCTION_WIN",
                status: "PAID",
                amount: finalPrice,
                quantity: 1,
              },
            })
        await deliverForOrder(
          order.id,
          auction.productId,
          opts.userId,
          finalPrice,
          tx,
          auction.product.deliveryType,
        )

        await tx.auction.update({
          where: { id: auction.id },
          data: {
            status: "SETTLED",
            paymentDeadlineAt: null,
            secondChanceUserId: null,
            secondChanceDeadlineAt: null,
          },
        })
        await recordAuctionEvent(
          {
            auctionId: auction.id,
            type: "PAYMENT_COMPLETED",
            userId: opts.userId,
            amount: finalPrice,
          },
          tx,
        )
        await recordAuctionEvent(
          { auctionId: auction.id, type: "SETTLED", userId: opts.userId, amount: finalPrice },
          tx,
        )
        await audit(
          {
            actorId: opts.userId,
            action: "auction.payment.completed",
            entity: "auction",
            entityId: auction.id,
            meta: { amount: finalPrice.toString(), remaining: obligation.remaining.toString() },
          },
          tx,
        )
        return {
          paid: true,
          title: auction.product.title,
          coverImage: auction.product.coverImage,
          userId: opts.userId,
          amount: finalPrice,
        }
      },
      { label: "auctionTx" },
    )
  }).then(async (res) => {
    await emit(Channels.auction(opts.auctionId), { type: "AUCTION_FINALIZED", auctionId: opts.auctionId })
    if (res.paid) {
      const { createNotification } = await import("./notifications")
      await createNotification({
        userId: res.userId!,
        type: "AUCTION_WON",
        title: "پرداخت با موفقیت انجام شد",
        body: `خرید شما در مزایده «${res.title}» نهایی شد.`,
        href: "/orders",
        image: res.coverImage,
      }).catch(() => {})
    }
    return res
  })
}

/**
 * Accept a live Second Chance Offer: the offered bidder becomes the winner and
 * enters the normal PAYMENT_PENDING → pay flow. Serialized + validated against
 * the offer holder and its deadline.
 */
export async function acceptSecondChanceOffer(opts: { auctionId: string; userId: string }) {
  return withLock(lockKey(opts.auctionId), async () => {
    return serializableTx(
      async (tx) => {
        const auction = await loadLiveAuction(opts.auctionId, tx)
        if (auction.status !== "PAYMENT_PENDING") {
          throw new ValidationError("پیشنهاد فرصت دوم برای این مزایده فعال نیست")
        }
        if (auction.secondChanceUserId !== opts.userId) {
          throw new ForbiddenError("پیشنهاد فرصت دومی برای شما ثبت نشده است")
        }
        if (auction.secondChanceDeadlineAt && auction.secondChanceDeadlineAt < new Date()) {
          throw new ValidationError("مهلت پذیرش پیشنهاد فرصت دوم به پایان رسیده است")
        }
        // Promote the offer holder to winner and open a fresh payment deadline.
        const policy = await getAuctionPolicy(auction.policyJson, tx)
        const deadline = computePaymentDeadline(policy)
        await tx.auction.update({
          where: { id: auction.id },
          data: {
            winnerUserId: opts.userId,
            paymentDeadlineAt: deadline,
            secondChanceDeadlineAt: null,
          },
        })
        await recordAuctionEvent(
          { auctionId: auction.id, type: "SECOND_CHANCE_ACCEPTED", userId: opts.userId },
          tx,
        )
        await audit(
          {
            actorId: opts.userId,
            action: "auction.secondChance.accepted",
            entity: "auction",
            entityId: auction.id,
          },
          tx,
        )
        return { accepted: true }
      },
      { label: "auctionTx" },
    )
  })
}

/**
 * Reject / decline a live Second Chance Offer. Immediately moves on to the next
 * eligible bidder (or applies the fallback) instead of waiting for expiry.
 */
export async function rejectSecondChanceOffer(opts: { auctionId: string; userId: string }) {
  return withLock(lockKey(opts.auctionId), async () => {
    const outcome = await serializableTx(
      async (tx) => {
        const auction = await loadLiveAuction(opts.auctionId, tx)
        if (auction.status !== "PAYMENT_PENDING" || auction.secondChanceUserId !== opts.userId) {
          throw new ValidationError("پیشنهاد فرصت دومی برای شما فعال نیست")
        }
        await recordAuctionEvent(
          { auctionId: auction.id, type: "SECOND_CHANCE_EXPIRED", userId: opts.userId },
          tx,
        )
        // Release the declining bidder's hold and advance the chain.
        await setAuctionFrozen(opts.userId, auction.id, 0n, tx)
        return advanceAfterDefault(auction.id, opts.userId, tx)
      },
      { label: "auctionTx" },
    )
    return outcome
  }).then(async (res) => {
    await emit(Channels.auction(opts.auctionId), { type: "AUCTION_FINALIZED", auctionId: opts.auctionId })
    await dispatchDefaultNotifications(res)
    return res
  })
}

/** Result of a default / second-chance advance step (drives notifications). */
interface DefaultOutcome {
  auctionId: string
  title: string
  coverImage: string | null
  /** New second-chance offer holder, if the chain produced one. */
  offeredUserId?: string | null
  offerDeadlineAt?: Date | null
  /** Terminal resolution when no further bidder / fallback applied. */
  resolution?: "SECOND_CHANCE" | "REOPEN" | "CANCEL" | "PENALTY" | "RESTRICT_USER" | "SETTLED_ELSEWHERE"
}

/**
 * Core winner-default state machine (runs INSIDE a serializable tx). Given the
 * auction and the user who just defaulted/declined, either offers the next
 * eligible bidder a second chance or applies the configured fallback action.
 * Every branch routes money through the Wallet Engine and records timeline +
 * audit entries. Returns a DefaultOutcome for out-of-tx notification dispatch.
 */
async function advanceAfterDefault(
  auctionId: string,
  defaultedUserId: string,
  tx: Tx,
): Promise<DefaultOutcome> {
  const auction = await loadLiveAuction(auctionId, tx)
  const policy = await getAuctionPolicy(auction.policyJson, tx)
  const action = resolveDefaultAction(policy)
  const base = { auctionId, title: auction.product.title, coverImage: auction.product.coverImage }

  // Build the eligible fallback chain: distinct bidders (highest first) above
  // reserve, excluding the defaulted user and anyone already offered/declined.
  const alreadyTried = new Set<string>([defaultedUserId])
  // Pull prior offer/decline history from the timeline so we never re-offer.
  const priorOffers = await tx.auctionEvent.findMany({
    where: { auctionId, type: { in: ["SECOND_CHANCE_OFFER", "SECOND_CHANCE_EXPIRED", "WINNER_DEFAULTED"] } },
    select: { userId: true },
  })
  for (const e of priorOffers) if (e.userId) alreadyTried.add(e.userId)

  if (action === "SECOND_CHANCE") {
    // Release the defaulting winner's deposit before advancing the chain
    // (SECOND_CHANCE forfeits nothing; PENALTY is the explicit forfeit action).
    await setAuctionFrozen(defaultedUserId, auctionId, 0n, tx)
    const ranked = await standings(auctionId, 50, tx)
    const next = ranked.find(
      (r) => !alreadyTried.has(r.userId) && (!auction.reservePrice || r.amount >= auction.reservePrice),
    )
    if (next) {
      const deadline = new Date(Date.now() + Math.max(1, policy.secondChanceWindowMinutes) * 60_000)
      await tx.auction.update({
        where: { id: auctionId },
        data: {
          winnerUserId: null,
          finalPrice: next.amount,
          secondChanceUserId: next.userId,
          secondChanceDeadlineAt: deadline,
          paymentDeadlineAt: deadline,
        },
      })
      await recordAuctionEvent(
        {
          auctionId,
          type: "SECOND_CHANCE_OFFER",
          userId: next.userId,
          amount: next.amount,
          meta: { deadlineAt: deadline.toISOString() },
        },
        tx,
      )
      await audit(
        { action: "auction.secondChance.offered", entity: "auction", entityId: auctionId, meta: { userId: next.userId } },
        tx,
      )
      return { ...base, offeredUserId: next.userId, offerDeadlineAt: deadline, resolution: "SECOND_CHANCE" }
    }
    // No eligible bidder left → fall through to a safe cancel/relist.
    await applyTerminalDefault(auctionId, "CANCEL", tx)
    return { ...base, resolution: "CANCEL" }
  }

  if (action === "REOPEN") {
    await applyTerminalDefault(auctionId, "REOPEN", tx)
    return { ...base, resolution: "REOPEN" }
  }
  if (action === "PENALTY") {
    await applyTerminalDefault(auctionId, "PENALTY", tx, { defaultedUserId, policy })
    return { ...base, resolution: "PENALTY" }
  }
  if (action === "RESTRICT_USER") {
    await applyTerminalDefault(auctionId, "RESTRICT_USER", tx, { defaultedUserId, policy })
    return { ...base, resolution: "RESTRICT_USER" }
  }
  await applyTerminalDefault(auctionId, "CANCEL", tx)
  return { ...base, resolution: "CANCEL" }
}

/**
 * Apply a terminal (non-second-chance) default resolution inside a tx. Releases
 * any remaining holds, optionally forfeits a deposit (PENALTY) or restricts the
 * defaulting user (RESTRICT_USER), and settles the auction into a final state.
 */
async function applyTerminalDefault(
  auctionId: string,
  action: "CANCEL" | "REOPEN" | "PENALTY" | "RESTRICT_USER",
  tx: Tx,
  extra?: { defaultedUserId: string; policy: Awaited<ReturnType<typeof getAuctionPolicy>> },
) {
  const auction = await loadLiveAuction(auctionId, tx)

  // PENALTY forfeits the defaulting winner's frozen deposit to the platform
  // (capture with no delivery) before releasing everyone else. All other actions
  // release the defaulter's hold in full.
  if (action === "PENALTY" && extra) {
    const held = await currentAuctionFrozen(extra.defaultedUserId, auctionId, tx)
    if (held > 0n) {
      // Capture with refType "auction" so currentAuctionFrozen nets it to zero
      // and the release loop below does not try to unfreeze it a second time.
      await captureFrozenPurchase(extra.defaultedUserId, held, tx, { type: "auction", id: auctionId })
    }
    await recordAuctionEvent(
      { auctionId, type: "PENALTY_APPLIED", userId: extra.defaultedUserId, amount: held },
      tx,
    )
    await audit(
      { action: "auction.default.penalty", entity: "auction", entityId: auctionId, meta: { userId: extra.defaultedUserId, forfeited: held.toString() } },
      tx,
    )
  }

  if (action === "RESTRICT_USER" && extra) {
    const until = new Date(Date.now() + restrictionDays(extra.policy) * 24 * 60 * 60_000)
    await tx.user.update({ where: { id: extra.defaultedUserId }, data: { auctionRestrictedUntil: until } })
    await recordAuctionEvent(
      { auctionId, type: "USER_RESTRICTED", userId: extra.defaultedUserId, meta: { until: until.toISOString() } },
      tx,
    )
    await audit(
      { action: "auction.default.restrictUser", entity: "user", entityId: extra.defaultedUserId, meta: { until: until.toISOString(), auctionId } },
      tx,
    )
  }

  // Release every hold still frozen against this auction (defaulter included,
  // unless PENALTY already captured it).
  const holders = await standings(auctionId, auction.quantity + 10, tx)
  for (const h of holders) {
    const frozen = await currentAuctionFrozen(h.userId, auctionId, tx)
    if (frozen > 0n) await setAuctionFrozen(h.userId, auctionId, 0n, tx)
  }

  if (action === "REOPEN") {
    // Relist: clear winner/settlement fields and schedule a fresh window.
    const policy = await getAuctionPolicy(auction.policyJson, tx)
    void policy
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        status: "SCHEDULED",
        winnerUserId: null,
        finalPrice: null,
        endReason: null,
        paymentDeadlineAt: null,
        secondChanceUserId: null,
        secondChanceDeadlineAt: null,
        currentPrice: auction.startPrice,
        startTime: new Date(),
        endTime: new Date(Date.now() + 24 * 60 * 60_000),
        softCloseExtensions: 0,
        endingSoonNotified: false,
      },
    })
    await recordAuctionEvent({ auctionId, type: "AUCTION_REOPENED" }, tx)
    await audit({ action: "auction.default.reopen", entity: "auction", entityId: auctionId }, tx)
    return
  }

  // CANCEL / PENALTY / RESTRICT_USER all end the sale as CANCELLED.
  await tx.auction.update({
    where: { id: auctionId },
    data: {
      status: "CANCELLED",
      endReason: "CANCELLED",
      paymentDeadlineAt: null,
      secondChanceUserId: null,
      secondChanceDeadlineAt: null,
    },
  })
  await recordAuctionEvent({ auctionId, type: "CANCELLED" }, tx)
}

/** Best-effort notification dispatch for a default/second-chance outcome. */
async function dispatchDefaultNotifications(res: DefaultOutcome) {
  const { createNotification } = await import("./notifications")
  if (res.offeredUserId) {
    await createNotification({
      userId: res.offeredUserId,
      type: "AUCTION_WON",
      title: "پیشنهاد فرصت دوم",
      body: `برنده قبلی مزایده «${res.title}» پرداخت را کامل نکرد. اکنون نوبت شماست — تا مهلت تعیین‌شده پرداخت را انجام دهید.`,
      href: "/orders",
      image: res.coverImage,
    }).catch(() => {})
  }
}

/**
 * Handle a defaulting winner whose payment deadline has passed (deposit /
 * partial-freeze mode only). Emits WINNER_DEFAULTED then runs the configured
 * default action. Serialized + idempotent. Returns the outcome for the caller.
 */
export async function handleWinnerDefault(auctionId: string) {
  return withLock(lockKey(auctionId), async () => {
    return serializableTx(
      async (tx) => {
        const auction = await loadLiveAuction(auctionId, tx)
        if (auction.status !== "PAYMENT_PENDING") return null
        // Only act once the payment deadline has truly elapsed.
        if (auction.paymentDeadlineAt && auction.paymentDeadlineAt > new Date()) return null

        const defaultedUserId = auction.winnerUserId ?? auction.secondChanceUserId
        if (!defaultedUserId) return null

        await recordAuctionEvent(
          { auctionId, type: "WINNER_DEFAULTED", userId: defaultedUserId },
          tx,
        )
        await audit(
          { action: "auction.winner.defaulted", entity: "auction", entityId: auctionId, meta: { userId: defaultedUserId } },
          tx,
        )
        // Notify the defaulter (best-effort, out of tx below via outcome flag).
        const outcome = await advanceAfterDefault(auctionId, defaultedUserId, tx)
        return { defaultedUserId, outcome }
      },
      { label: "auctionTx" },
    )
  }).then(async (r) => {
    if (!r) return { handled: false }
    await emit(Channels.auction(auctionId), { type: "AUCTION_FINALIZED", auctionId })
    const { createNotification } = await import("./notifications")
    await createNotification({
      userId: r.defaultedUserId,
      type: "AUCTION_LOST",
      title: "مهلت پرداخت به پایان رسید",
      body: `به دلیل عدم تکمیل پرداخت در مزایده «${r.outcome.title}»، برد شما لغو شد.`,
      href: "/auctions",
      image: r.outcome.coverImage,
    }).catch(() => {})
    await dispatchDefaultNotifications(r.outcome)
    return { handled: true, resolution: r.outcome.resolution }
  })
}

/**
 * Cron entry: process every PAYMENT_PENDING auction whose payment (or active
 * second-chance offer) deadline has elapsed, applying the configured default
 * action. Safe to call every tick; each auction is serialized + idempotent.
 */
export async function processPaymentDeadlines(): Promise<{ processed: number }> {
  const due = await prisma.auction.findMany({
    where: { status: "PAYMENT_PENDING", paymentDeadlineAt: { lte: new Date() } },
    select: { id: true },
    take: 100,
  })
  let processed = 0
  for (const a of due) {
    try {
      const r = await handleWinnerDefault(a.id)
      if (r.handled) processed++
    } catch {
      // Skip and let the next tick retry.
    }
  }
  return { processed }
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
        if (auction.status === "CANCELLED") {
          return { cancelled: false, released: 0 }
        }
        // A settled auction (SOLD / SETTLED / RESERVE_NOT_MET / FINALIZED) can no
        // longer be cancelled — funds are already captured or released.
        if (isTerminalStatus(auction.status)) {
          throw new ValidationError("مزایده نهایی‌شده قابل لغو نیست")
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
