import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { audit } from "@/lib/core/audit"
import { enqueueEmail } from "@/lib/email/queue"
import { processEmailQueue } from "@/lib/email/worker"
import { renderTemplate } from "@/lib/email/templates"
import { DomainError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const baseFields = {
  subject: z.string().trim().min(1, "موضوع الزامی است").max(200),
  heading: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, "متن ایمیل الزامی است").max(20000),
  actionUrl: z.string().trim().url("لینک نامعتبر است").max(2000).optional().or(z.literal("")),
  actionLabel: z.string().trim().max(80).optional(),
  locale: z.enum(["fa", "en"]).default("fa"),
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview"), ...baseFields }),
  z.object({
    action: z.literal("send"),
    to: z.string().trim().email("ایمیل گیرنده نامعتبر است"),
    ...baseFields,
  }),
])

/** Build the GENERIC template payload from validated compose input. */
function toPayload(input: z.infer<typeof schema>) {
  return {
    subject: input.subject,
    heading: input.heading || input.subject,
    body: input.body,
    ...(input.actionUrl ? { actionUrl: input.actionUrl, actionLabel: input.actionLabel || undefined } : {}),
  }
}

/**
 * Email composer backend.
 * - `preview`: renders the GENERIC template server-side and returns the HTML so
 *   the admin sees the real email before sending. No mail is sent.
 * - `send`: queues a single test email to one recipient and drains immediately.
 *
 * Bulk/broadcast sending is intentionally NOT handled here — it is a separate
 * future milestone (audience selection, batching, retries, analytics, etc.).
 */
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const input = schema.parse(await req.json())
  const payload = toPayload(input)

  if (input.action === "preview") {
    const rendered = renderTemplate("GENERIC", payload, { locale: input.locale })
    return { subject: rendered.subject, html: rendered.html }
  }

  const res = await enqueueEmail({
    template: "GENERIC",
    to: input.to,
    locale: input.locale,
    payload,
    // Unique key so repeated test sends to the same address are never deduped.
    idempotencyKey: `compose-test:${input.to}:${Date.now()}`,
    priority: 1,
  })

  if (!res.queued) throw new DomainError(res.reason ?? "ارسال آزمایشی ناموفق بود", "EMAIL_SEND_FAILED", 400)

  const drained = await processEmailQueue()
  await audit({
    actorId: admin.id,
    action: "email.compose.test",
    entity: "EmailJob",
    entityId: res.jobId ?? null,
    meta: { to: input.to, subject: input.subject },
  })
  return { ok: true, jobId: res.jobId, drained }
})
