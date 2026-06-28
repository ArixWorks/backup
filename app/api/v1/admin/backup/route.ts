import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { audit } from "@/lib/core/audit"
import { runBackupNow } from "@/lib/core/backup-runner"
import { DomainError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Create a backup NOW and send it to the configured (or overridden) Telegram
 * chat. This is the manual "backup now" button in the admin panel.
 */
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = await req.json().catch(() => ({}))
  const chatId = typeof body?.chatId === "string" && body.chatId.trim() ? body.chatId.trim() : undefined

  const res = await runBackupNow(chatId)
  if (!res.ok) throw new DomainError(res.error ?? "پشتیبان‌گیری ناموفق بود", "BACKUP_FAILED", 400)

  await audit({
    actorId: admin.id,
    action: "BACKUP_CREATE_SEND",
    entity: "Backup",
    entityId: res.filename ?? null,
    meta: { sizeBytes: res.sizeBytes, totalRows: res.totalRows, chatId: res.chatId },
  })
  return res
})
