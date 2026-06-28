import "server-only"
import { Prisma, EmailStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { SETTING_KEYS, getSetting } from "@/lib/core/settings"
import { renderTemplate, type Locale, type TemplatePayload } from "@/lib/email/templates"
import { deliverNow, EmailDeliveryError } from "@/lib/email/transport"
import { resolveSender } from "@/lib/email/senders"

/** Per-minute send budget, enforced across worker invocations via the DB. */
async function sentInLastMinute(): Promise<number> {
  const since = new Date(Date.now() - 60_000)
  return prisma.emailJob.count({ where: { sentAt: { gte: since } } })
}

function backoffSeconds(attempt: number): number {
  // Exponential backoff with jitter: ~30s, 2m, 8m, 32m, 2h, capped.
  const base = Math.min(30 * Math.pow(4, attempt - 1), 7200)
  const jitter = Math.floor(Math.random() * Math.min(base * 0.25, 60))
  return base + jitter
}

export type WorkerResult = {
  claimed: number
  sent: number
  failed: number
  retried: number
  skippedRateLimited: boolean
}

/**
 * Process a batch of due email jobs. Designed to be called from the cron tick.
 * Each job is claimed atomically (QUEUED→PROCESSING with a conditional update)
 * so concurrent ticks never double-send. Safe to call frequently.
 */
export async function processEmailQueue(): Promise<WorkerResult> {
  const result: WorkerResult = { claimed: 0, sent: 0, failed: 0, retried: 0, skippedRateLimited: false }

  const enabled = (await getSetting(SETTING_KEYS.emailEnabled)) !== "false"
  if (!enabled) return result

  const batchSize = clampInt(await getSetting(SETTING_KEYS.emailBatchSize), 25, 1, 200)
  const ratePerMinute = clampInt(await getSetting(SETTING_KEYS.emailRatePerMinute), 60, 1, 5000)

  const alreadySent = await sentInLastMinute()
  let budget = Math.max(0, ratePerMinute - alreadySent)
  if (budget === 0) {
    result.skippedRateLimited = true
    return result
  }

  const now = new Date()
  const due = await prisma.emailJob.findMany({
    where: { status: EmailStatus.QUEUED, nextAttemptAt: { lte: now } },
    orderBy: [{ priority: "asc" }, { nextAttemptAt: "asc" }],
    take: Math.min(batchSize, budget),
  })

  for (const job of due) {
    if (budget <= 0) break

    // Atomically claim: only succeeds if still QUEUED (guards against races).
    const claim = await prisma.emailJob.updateMany({
      where: { id: job.id, status: EmailStatus.QUEUED },
      data: { status: EmailStatus.PROCESSING, processingAt: new Date(), attempts: { increment: 1 } },
    })
    if (claim.count === 0) continue
    result.claimed++

    const attemptNo = job.attempts + 1
    try {
      const locale: Locale = job.locale === "en" ? "en" : "fa"
      const rendered = renderTemplate(job.template, (job.payload ?? {}) as TemplatePayload, {
        locale,
        baseUrl: process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, ""),
      })
      const sender = await resolveSender(job.sender)
      const replyTo = sender.replyTo || (await getSetting(SETTING_KEYS.emailReplyTo)) || undefined

      const sent = await deliverNow({
        from: sender.from,
        to: job.to,
        subject: job.subject || rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo,
        tags: [
          { name: "template", value: job.template },
          { name: "jobId", value: job.id },
        ],
      })

      budget--

      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          providerId: sent.providerId,
          lastError: sent.skipped ? "provider not configured (logged only)" : null,
        },
      })
      await recordEvent(job.id, sent.providerId, "email.sent", { skipped: sent.skipped ?? false })
      result.sent++
    } catch (err) {
      // EmailDeliveryError carries a `permanent` flag; everything else is treated
      // as transient and retried until maxAttempts.
      const permanent = err instanceof EmailDeliveryError ? err.permanent : false
      const message = err instanceof Error ? err.message : String(err)
      if (!permanent && attemptNo < job.maxAttempts) {
        await scheduleRetry(job.id, attemptNo, message)
        result.retried++
      } else {
        await failJob(job.id, message)
        result.failed++
      }
    }
  }

  return result
}

async function scheduleRetry(jobId: string, attemptNo: number, error: string) {
  await prisma.emailJob.update({
    where: { id: jobId },
    data: {
      status: EmailStatus.QUEUED,
      nextAttemptAt: new Date(Date.now() + backoffSeconds(attemptNo) * 1000),
      lastError: error.slice(0, 1000),
    },
  })
}

async function failJob(jobId: string, error: string) {
  await prisma.emailJob.update({
    where: { id: jobId },
    data: { status: EmailStatus.FAILED, failedAt: new Date(), lastError: error.slice(0, 1000) },
  })
  await recordEvent(jobId, null, "email.failed", { error })
}

async function recordEvent(jobId: string | null, providerId: string | null, type: string, payload: unknown) {
  await prisma.emailEvent
    .create({
      data: {
        jobId: jobId ?? undefined,
        providerId: providerId ?? undefined,
        type,
        payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    .catch(() => {})
}

function clampInt(raw: string | null | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(String(raw ?? ""), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}
