import { prisma } from "@/lib/db"
import { EmailStatus } from "@prisma/client"
import type { Prisma } from "@prisma/client"

// Resend (Svix) delivery webhook payload — only the bits we rely on.
export interface ProviderWebhookEvent {
  type: string // e.g. "email.delivered", "email.bounced", "email.opened"
  data?: {
    email_id?: string
    [key: string]: unknown
  }
}

// Map a provider event type onto the terminal/feedback status it implies.
const STATUS_BY_EVENT: Record<string, EmailStatus | undefined> = {
  "email.delivered": EmailStatus.DELIVERED,
  "email.bounced": EmailStatus.BOUNCED,
  "email.complained": EmailStatus.COMPLAINED,
  // delivery_delayed / sent / opened / clicked do not change the core status.
}

/**
 * Apply an inbound provider webhook event: append the raw event for the audit
 * trail, then reconcile the owning EmailJob (status, open/click counters,
 * timestamps). Idempotent and best-effort — unknown jobs are still logged.
 */
export async function applyProviderEvent(evt: ProviderWebhookEvent): Promise<{ matched: boolean }> {
  const providerId = evt.data?.email_id ?? null
  const job = providerId ? await prisma.emailJob.findFirst({ where: { providerId } }) : null

  await prisma.emailEvent
    .create({
      data: {
        jobId: job?.id ?? undefined,
        providerId: providerId ?? undefined,
        type: evt.type,
        payload: (evt.data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    .catch(() => {})

  if (!job) return { matched: false }

  const now = new Date()
  const data: Prisma.EmailJobUpdateInput = {}

  const mapped = STATUS_BY_EVENT[evt.type]
  if (mapped) {
    data.status = mapped
    if (mapped === EmailStatus.DELIVERED) data.deliveredAt = now
    if (mapped === EmailStatus.BOUNCED || mapped === EmailStatus.COMPLAINED) {
      data.failedAt = now
      data.lastError = evt.type
    }
  }
  if (evt.type === "email.opened") {
    data.openCount = { increment: 1 }
    if (!job.openedAt) data.openedAt = now
  }
  if (evt.type === "email.clicked") {
    data.clickCount = { increment: 1 }
    if (!job.clickedAt) data.clickedAt = now
  }

  if (Object.keys(data).length) {
    await prisma.emailJob.update({ where: { id: job.id }, data }).catch(() => {})
  }
  return { matched: true }
}
