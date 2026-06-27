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

/** RTL-friendly wrapper so all transactional emails share one look. */
function layout(title: string, body: string): string {
  return `<!doctype html><html dir="rtl" lang="fa"><body style="margin:0;background:#0f0f0f;font-family:Tahoma,Arial,sans-serif;color:#e8e8e8;padding:24px">
    <div style="max-width:480px;margin:0 auto;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:28px">
      <h1 style="font-size:18px;color:#e9b949;margin:0 0 16px">${title}</h1>
      <div style="font-size:14px;line-height:1.9;color:#cfcfcf">${body}</div>
      <p style="font-size:12px;color:#7a7a7a;margin-top:24px">اگر این درخواست را شما ثبت نکرده‌اید، این پیام را نادیده بگیرید.</p>
    </div>
  </body></html>`
}

function buttonRow(href: string, label: string): string {
  return `<div style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#e9b949;color:#1a1a1a;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">${label}</a></div>
    <p style="font-size:12px;color:#9a9a9a;word-break:break-all">یا این نشانی را کپی کنید:<br>${href}</p>`
}

export async function sendVerificationEmail(to: string, link: string) {
  return sendEmail({
    to,
    subject: "تأیید ایمیل — Subio Shop",
    html: layout(
      "تأیید آدرس ایمیل",
      `برای فعال‌سازی ایمیل خود روی دکمه زیر بزنید. این لینک تا ۳۰ دقیقه معتبر است.${buttonRow(link, "تأیید ایمیل")}`,
    ),
  })
}

export async function sendPasswordResetEmail(to: string, link: string) {
  return sendEmail({
    to,
    subject: "بازیابی رمز عبور — Subio Shop",
    html: layout(
      "بازیابی رمز عبور",
      `برای تعیین رمز عبور جدید روی دکمه زیر بزنید. این لینک تا ۳۰ دقیقه معتبر است.${buttonRow(link, "تعیین رمز جدید")}`,
    ),
  })
}
