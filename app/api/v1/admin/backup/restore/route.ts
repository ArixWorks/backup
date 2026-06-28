import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { audit } from "@/lib/core/audit"
import { restoreBackup } from "@/lib/core/backup"
import { DomainError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * DESTRUCTIVE: wipe the database and restore it from an uploaded backup file.
 * Requires the admin to type the confirmation phrase, so an accidental click
 * can never erase live data. Accepts multipart/form-data with `file` + `confirm`.
 */
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()

  const form = await req.formData().catch(() => null)
  if (!form) throw new DomainError("فرمت درخواست نامعتبر است", "BAD_REQUEST", 400)

  const confirm = String(form.get("confirm") ?? "")
  if (confirm !== "RESTORE") {
    throw new DomainError("برای بازیابی باید عبارت تأیید را وارد کنید", "CONFIRM_REQUIRED", 400)
  }

  const file = form.get("file")
  if (!(file instanceof File)) throw new DomainError("فایل پشتیبان ارسال نشده است", "NO_FILE", 400)
  if (file.size > 100 * 1024 * 1024) throw new DomainError("حجم فایل بیش از حد مجاز است", "TOO_LARGE", 400)

  const buffer = Buffer.from(await file.arrayBuffer())

  let summary
  try {
    summary = await restoreBackup(buffer)
  } catch (err) {
    throw new DomainError((err as Error).message || "بازیابی ناموفق بود", "RESTORE_FAILED", 400)
  }

  // The admin account may have changed id after restore; log best-effort.
  await audit({
    actorId: admin.id,
    action: "BACKUP_RESTORE",
    entity: "Backup",
    entityId: file.name,
    meta: { totalRows: summary.totalRows, backupCreatedAt: summary.createdAt },
  }).catch(() => {})

  return summary
})
