import "server-only"
import { Resend } from "resend"
import { withRetry, withTimeout, TimeoutError } from "@/lib/core/resilience"

/**
 * Transactional email via Resend. If RESEND_API_KEY is not configured we log
 * the message instead of throwing, so local/dev flows keep working (the link is
 * printed to the server console). Set RESEND_FROM to a verified sender; we fall
 * back to Resend's shared onboarding address otherwise.
 */

const FROM = process.env.RESEND_FROM || "Subio Shop <onboarding@resend.dev>"

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<{ sent: boolean }> {
  const resend = client()
  if (!resend) {
    console.log("[v0] RESEND_API_KEY missing — email not sent. Preview:", {
      to: opts.to,
      subject: opts.subject,
    })
    return { sent: false }
  }
  // Resilient send: bound each attempt to 10s (so an unreachable Resend can't
  // hang the request) and retry transient failures with exponential backoff.
  // A 4xx (e.g. invalid recipient) is not retried.
  await withRetry(
    async () => {
      const { error } = await withTimeout(
        10_000,
        () =>
          resend.emails.send({
            from: FROM,
            to: opts.to,
            subject: opts.subject,
            html: opts.html,
          }),
        "resend.send",
      )
      if (error) {
        const status = (error as { statusCode?: number }).statusCode ?? 0
        const e = new Error(error.message || "Resend error") as Error & { status?: number }
        e.status = status
        throw e
      }
    },
    {
      attempts: 3,
      baseDelayMs: 400,
      maxDelayMs: 4_000,
      retryable: (err) =>
        err instanceof TimeoutError || ((err as { status?: number })?.status ?? 500) >= 500,
      onRetry: (err, attempt, delay) =>
        console.log(`[v0] Resend retry ${attempt} in ${delay}ms:`, (err as Error).message),
    },
  ).catch((err) => {
    console.log("[v0] Resend send error (after retries):", (err as Error).message)
    throw new Error("ارسال ایمیل ناموفق بود")
  })
  return { sent: true }
}

// NOTE: Transactional emails (verification, reset, receipts, …) now go through
// the durable queue in `lib/email/*`. This module is kept ONLY as the low-level
// `sendEmail` used by the monitoring dispatcher for immediate operational
// alerts, which must not wait on the queue/worker cycle.
