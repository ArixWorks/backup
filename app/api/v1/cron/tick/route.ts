import { route } from "@/lib/api/handler"
import { activateDueAuctions, tickDueAuctions, notifyEndingSoonAuctions } from "@/lib/core/auction"
import { tickGiveaways } from "@/lib/core/giveaway"
import { collectStartNotifications } from "@/lib/core/watchlist"
import { emit, Channels } from "@/lib/core/events"
import { prisma } from "@/lib/db"
import { notifyAuctionStarted } from "@/lib/telegram/notify"
import { withCron } from "@/lib/monitoring/instrument"
import { touchHeartbeat } from "@/lib/monitoring/heartbeat"

// Scheduled worker entry point: activate scheduled auctions and finalize ended
// ones. Wire this to a cron (Vercel Cron, or a BullMQ/Redis worker self-hosted).
export const POST = route(async (req: Request) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      const { ForbiddenError } = await import("@/lib/core/errors")
      throw new ForbiddenError("Invalid cron secret")
    }
  }
  // Record a liveness heartbeat so the Operations Center can detect a stalled
  // scheduler (no tick within the expected interval => cron service DOWN). The
  // meta carries the real run duration so `app.cron.duration` stays populated
  // regardless of which cron job ran most recently.
  const startedAt = Date.now()
  let failed = 0
  try {
    return await withCron("tick", async () => {
  const activated = await activateDueAuctions()

  // Notify watchers of auctions that just went live (Watchlist alerts).
  let notified = 0
  for (const auctionId of activated.activatedIds) {
    const watchers = await collectStartNotifications(auctionId)
    if (watchers.length > 0) {
      notified += watchers.length
      await emit(Channels.auction(auctionId), {
        type: "AUCTION_STARTED",
        auctionId,
        watchers: watchers.length,
      })
      // Push a Telegram alert to each watcher (best-effort).
      const auction = await prisma.auction.findUnique({
        where: { id: auctionId },
        include: { product: { select: { title: true, coverImage: true } } },
      })
      if (auction) {
        const { createNotification } = await import("@/lib/core/notifications")
        for (const w of watchers) {
          await notifyAuctionStarted(
            w.id,
            auctionId,
            auction.product.title,
            auction.startPrice,
            auction.product.coverImage,
          )
          await createNotification({
            userId: w.id,
            type: "AUCTION_STARTED",
            title: "مزایده شروع شد",
            body: `مزایده «${auction.product.title}» که دنبال می‌کردید شروع شد!`,
            href: `/auctions/${auctionId}`,
            image: auction.product.coverImage,
          }).catch(() => {})
        }
      }
    }
  }

  // Alert leading bidders of auctions about to end (once per auction).
  const endingSoon = await notifyEndingSoonAuctions()

  const ticked = await tickDueAuctions()

  // Giveaway lifecycle: open scheduled, close to LOCKED at draw time, send the
  // pre-draw admin alert, and auto-draw any campaign flagged autoDraw.
  const giveaways = await tickGiveaways()

  return {
    activated: activated.activated,
    notified,
    endingSoon: endingSoon.notified,
    ...ticked,
    giveaways,
  }
    })
  } catch (err) {
    failed = 1
    throw err
  } finally {
    void touchHeartbeat("cron", { durationMs: Date.now() - startedAt, failures: failed })
  }
})

export const GET = POST
