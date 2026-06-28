import "server-only"
import crypto from "node:crypto"
import type { EmailSenderId, EmailTemplateKey } from "@prisma/client"
import { prisma } from "@/lib/db"
import { SETTING_KEYS, getSetting, toBool, toNumber } from "@/lib/core/settings"
import { validateEmail } from "./validation"
import { renderTemplate, type Locale, type TemplatePayload } from "./templates"

/**
 * The enqueue side of the email system. Nothing is sent inline here: every
 * outbound email becomes a durable `EmailJob` row (so it survives restarts and
 * is captured by DB backups) and is later processed asynchronously by the
 * worker. Validation and idempotency are enforced before a job is created.
 */

export interface EnqueueInput {
  template: EmailTemplateKey
  /** Explicit recipient. If omitted, resolved from `userId`'s verified email. */
  to?: string
  /** Soft reference; also used to resolve the recipient + locale when `to` is absent. */
  userId?: string
  sender?: EmailSenderId
  locale?: Locale
  payload?: TemplatePayload
  /** Provide for strong dedupe (e.g. "deposit-approved:<id>"). Auto-generated otherwise. */
  idempotencyKey?: string
  /** Lower runs sooner (default 5). Use 1-2 for security/critical mail. */
  priority?: number
  maxAttempts?: number
}

export type EnqueueResult =
  | { queued: true; jobId: string; deduped?: boolean }
  | { queued: false; reason: string; jobId?: string }

interface RecipientInfo {
  email: string | null
  locale: Locale
  userId?: string
}

/** Resolve the recipient address + preferred locale. */
async function resolveRecipient(input: EnqueueInput): Promise<RecipientInfo> {
  if (input.to) {
    return { email: input.to, locale: input.locale ?? "fa", userId: input.userId }
  }
  if (input.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, emailVerified: true, languageCode: true },
    })
    const locale: Locale = input.locale ?? (user?.languageCode === "en" ? "en" : "fa")
    // Only send to a verified address when resolving from a user.
    const email = user?.email && user.emailVerified ? user.email : null
    return { email, locale, userId: input.userId }
  }
  return { email: null, locale: input.locale ?? "fa" }
}

function autoKey(template: EmailTemplateKey, to: string): string {
  return `${template}:${to}:${crypto.randomUUID()}`
}

/**
 * Queue an email. Returns `{ queued:false }` (never throws) for non-fatal
 * conditions — disabled service, no recipient, invalid address — so callers in
 * hot paths (login, purchase…) are never blocked by email concerns.
 */
export async function enqueueEmail(input: EnqueueInput): Promise<EnqueueResult> {
  // 1) Master switch.
  const enabled = toBool(await getSetting(SETTING_KEYS.emailEnabled))
  if (!enabled) return { queued: false, reason: "email_disabled" }

  // 2) Recipient resolution.
  const recipient = await resolveRecipient(input)
  if (!recipient.email) return { queued: false, reason: "no_recipient" }

  // 3) Validation (reserved domains always; disposable only if enabled).
  const blockDisposable = toBool(await getSetting(SETTING_KEYS.emailBlockDisposable))
  const v = validateEmail(recipient.email, { blockDisposable })

  const sender: EmailSenderId = input.sender ?? "NOREPLY"
  const idempotencyKey = input.idempotencyKey ?? autoKey(input.template, v.email)
  const maxAttempts = input.maxAttempts ?? toNumber(await getSetting(SETTING_KEYS.emailMaxAttempts), 5)

  // Render once now to capture the subject for the log/preview. HTML is
  // re-rendered at send time so template/branding changes always apply.
  let subject = ""
  try {
    subject = renderTemplate(input.template, input.payload ?? {}, { locale: recipient.locale }).subject
  } catch {
    subject = "Subio Shop"
  }

  // 4) Invalid address: record a CANCELED job for admin visibility, don't send.
  if (!v.ok) {
    try {
      const job = await prisma.emailJob.create({
        data: {
          idempotencyKey,
          template: input.template,
          sender,
          to: v.email,
          locale: recipient.locale,
          subject,
          payload: (input.payload ?? undefined) as object | undefined,
          status: "CANCELED",
          userId: recipient.userId ?? null,
          lastError: v.message ?? v.reason ?? "invalid_recipient",
          failedAt: new Date(),
          maxAttempts,
        },
      })
      return { queued: false, reason: v.reason ?? "invalid", jobId: job.id }
    } catch {
      return { queued: false, reason: v.reason ?? "invalid" }
    }
  }

  // 5) Idempotency fast-path: if a job already exists for this key, return it
  //    without attempting an insert (avoids a noisy unique-violation in logs).
  const prior = await prisma.emailJob.findUnique({ where: { idempotencyKey }, select: { id: true } })
  if (prior) return { queued: true, jobId: prior.id, deduped: true }

  // 6) Create the QUEUED job. A unique-key conflict here means a concurrent
  //    enqueue won the race — treat as success without creating a duplicate.
  try {
    const job = await prisma.emailJob.create({
      data: {
        idempotencyKey,
        template: input.template,
        sender,
        to: v.email,
        locale: recipient.locale,
        subject,
        payload: (input.payload ?? undefined) as object | undefined,
        status: "QUEUED",
        priority: input.priority ?? 5,
        userId: recipient.userId ?? null,
        maxAttempts,
        nextAttemptAt: new Date(),
      },
    })
    return { queued: true, jobId: job.id }
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      const existing = await prisma.emailJob.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      })
      return { queued: true, jobId: existing?.id ?? "", deduped: true }
    }
    console.log("[v0] enqueueEmail error:", (e as Error).message)
    return { queued: false, reason: "enqueue_error" }
  }
}

/** Cancel a queued job before it sends (admin action). */
export async function cancelEmailJob(jobId: string): Promise<{ ok: boolean }> {
  const result = await prisma.emailJob.updateMany({
    where: { id: jobId, status: { in: ["QUEUED", "FAILED"] } },
    data: { status: "CANCELED", failedAt: new Date() },
  })
  return { ok: result.count > 0 }
}

/** Re-queue a failed/bounced/canceled job for another attempt (admin action). */
export async function retryEmailJob(jobId: string): Promise<{ ok: boolean }> {
  const result = await prisma.emailJob.updateMany({
    where: { id: jobId, status: { in: ["FAILED", "BOUNCED", "CANCELED"] } },
    data: { status: "QUEUED", attempts: 0, nextAttemptAt: new Date(), lastError: null },
  })
  return { ok: result.count > 0 }
}
