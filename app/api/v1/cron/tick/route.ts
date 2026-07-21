import { route } from "@/lib/api/handler"
import { requireCronAuth } from "@/lib/api/cron-auth"
import {
  activateDueAuctions,
  tickDueAuctions,
  notifyEndingSoonAuctions,
  processPaymentDeadlines,
} from "@/lib/core/auction"
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
  // Fail-closed auth: in production a missing/invalid CRON_SECRET rejects the
  // request (this endpoint runs backups, finalizes auctions and drains email).
  requireCronAuth(req)
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

  // Winner-default lifecycle: apply the configured default action to any
  // deposit/partial-freeze auction whose payment (or second-chance) deadline
  // has elapsed. A no-op for the default full-freeze mode (nothing ever pends).
  let paymentDeadlines: { processed: number } = { processed: 0 }
  try {
    paymentDeadlines = await processPaymentDeadlines()
  } catch (e) {
    console.log("[v0] payment deadline processing error:", (e as Error).message)
  }

  // Giveaway lifecycle: open scheduled, close to LOCKED at draw time, send the
  // pre-draw admin alert, and auto-draw any campaign flagged autoDraw.
  const giveaways = await tickGiveaways()

  // Daily database backup, gated to once per Tehran-local day at the configured
  // hour (default 00:00). Best-effort: never let a backup failure break the tick.
  let backup: { ran: boolean; reason?: string } = { ran: false }
  try {
    const { maybeRunDailyBackup } = await import("@/lib/core/backup-runner")
    backup = await maybeRunDailyBackup()
  } catch (e) {
    console.log("[v0] daily backup gate error:", (e as Error).message)
  }

  // Refresh live FX rates from Wallex (USDT→dollar, GRAM→TON) once per hour.
  // Gated internally by interval + last-sync timestamp. Best-effort: a Wallex
  // outage records the error and leaves the previous rates untouched.
  let wallex: { ran: boolean; reason?: string; usdToman?: number; tonToman?: number } = { ran: false }
  try {
    const { maybeSyncWallexRates } = await import("@/lib/core/wallex")
    wallex = await maybeSyncWallexRates()
  } catch (e) {
    console.log("[v0] wallex FX sync error:", (e as Error).message)
  }

  // Drain the transactional email queue (rate-limited inside the worker).
  // Best-effort: a mail failure must never break the scheduler tick.
  let email: { claimed: number; sent: number; failed: number; retried: number } = {
    claimed: 0,
    sent: 0,
    failed: 0,
    retried: 0,
  }
  try {
    const emailStart = Date.now()
    const { processEmailQueue } = await import("@/lib/email/worker")
    const r = await processEmailQueue()
    email = { claimed: r.claimed, sent: r.sent, failed: r.failed, retried: r.retried }
    // Report the email queue as a live "queue" worker to the Operations Center,
    // carrying real backlog size + processing latency for the queue metrics.
    const { prisma } = await import("@/lib/db")
    const pending = await prisma.emailJob.count({ where: { status: "QUEUED" } }).catch(() => 0)
    void touchHeartbeat("queue", { size: pending, latencyMs: Date.now() - emailStart })
  } catch (e) {
    console.log("[v0] email queue processing error:", (e as Error).message)
  }

  // Drain scheduled and active Telegram/web-app broadcast campaigns in small,
  // idempotent batches. Best-effort so a recipient/API failure cannot stop cron.
  let broadcasts: { campaigns: number; processed: number } = { campaigns: 0, processed: 0 }
  try {
    const { processBroadcastQueue } = await import("@/lib/broadcast/core")
    broadcasts = await processBroadcastQueue()
  } catch (e) {
    console.log("[v0] broadcast queue processing error:", (e as Error).message)
  }

  // Run due AI automations (daily digest, ticket triage, ...). Best-effort:
  // each automation is isolated and an AI failure must never break the tick.
  let automations: { ran: number } = { ran: 0 }
  try {
    const { runDueAutomations } = await import("@/lib/ai/automations")
    automations = await runDueAutomations()
  } catch (e) {
    console.log("[v0] AI automations error:", (e as Error).message)
  }

  // Drain a small translation batch on every tick. Jobs are idempotent, retry
  // with exponential backoff, and never block unrelated lifecycle work.
  let translations: { processed: number; pending: number; queued: number } = { processed: 0, pending: 0, queued: 0 }
  try {
    const { enqueueTranslationBackfill, processTranslationQueue } = await import("@/lib/i18n/content-translation")
    const backfill = await enqueueTranslationBackfill(12)
    translations = { ...(await processTranslationQueue(4)), queued: backfill.queued }
  } catch (e) {
    console.log("[v0] translation queue error:", (e as Error).message)
  }

  // Process domain purchase holds, registrar fulfillment, reminders and expiry
  // refunds. Best-effort: provider downtime must not block unrelated workers.
  let domains: { processed: number; expired: number; reminders: number } = {
    processed: 0,
    expired: 0,
    reminders: 0,
  }
  try {
    const { processDueDomainOrders } = await import("@/lib/core/domains/service")
    domains = await processDueDomainOrders()
  } catch (e) {
    console.log("[v0] domain lifecycle processing error:", (e as Error).message)
  }

  // Re-evaluate second-level referral rewards that were parked purely for a
  // maturity/cooldown gate (not a hard abuse signal) and whose gate has since
  // cleared → auto-approve + credit the now-clean ones. Best-effort.
  let referralRewards: { scanned: number; approved: number } = { scanned: 0, approved: 0 }
  try {
    const { processPendingReferralRewards } = await import("@/lib/core/referral")
    referralRewards = await processPendingReferralRewards()
  } catch (e) {
    console.log("[v0] referral reward re-eval error:", (e as Error).message)
  }

  return {
    activated: activated.activated,
    notified,
    endingSoon: endingSoon.notified,
    ...ticked,
    paymentDeadlines: paymentDeadlines.processed,
    giveaways,
    backup,
    wallex,
    email,
    broadcasts,
    automations,
    translations,
    domains,
    referralRewards,
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
