import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { audit } from "@/lib/core/audit"
import { enqueueEmail } from "@/lib/email/queue"
import { processEmailQueue } from "@/lib/email/worker"
import { DomainError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const schema = z.object({
  to: z.string().trim().email("ایمیل نامعتبر است"),
  locale: z.enum(["fa", "en"]).default("fa"),
  drain: z.boolean().default(true),
})

/**
 * Queue a GENERIC test email to the given address and (optionally) drain the
 * queue immediately so the admin gets instant feedback instead of waiting for
 * the next cron tick.
 */
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const { to, locale, drain } = schema.parse(await req.json())

  const res = await enqueueEmail({
    template: "GENERIC",
    to,
    locale,
    payload: {
      subject: locale === "en" ? "Test email — Subio Shop" : "ایمیل آزمایشی — Subio Shop",
      heading: locale === "en" ? "It works!" : "ایمیل‌ها کار می‌کنند!",
      body:
        locale === "en"
          ? "This is a test email from your Subio Shop admin panel. If you received it, delivery is configured correctly."
          : "این یک ایمیل آزمایشی از پنل مدیریت Subio Shop است. اگر آن را دریافت کردید، پیکربندی ارسال درست است.",
    },
    // Unique key so repeated tests are not deduped.
    idempotencyKey: `test:${to}:${Date.now()}`,
    priority: 1,
  })

  if (!res.queued) throw new DomainError(res.reason ?? "ارسال آزمایشی ناموفق بود", "EMAIL_TEST_FAILED", 400)

  let drained: Awaited<ReturnType<typeof processEmailQueue>> | null = null
  if (drain) drained = await processEmailQueue()

  await audit({ actorId: admin.id, action: "email.test", entity: "EmailJob", entityId: res.jobId ?? null, meta: { to } })
  return { ok: true, jobId: res.jobId, drained }
})
