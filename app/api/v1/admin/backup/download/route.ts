import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { audit } from "@/lib/core/audit"
import { createBackup } from "@/lib/core/backup"
import { DomainError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * Stream a fresh backup file straight to the admin's browser as a download.
 * Separate from the JSON `route()` helper because it returns a binary body.
 */
export async function GET() {
  try {
    const admin = await requireAdmin()
    const backup = await createBackup()
    await audit({
      actorId: admin.id,
      action: "BACKUP_DOWNLOAD",
      entity: "Backup",
      entityId: backup.filename,
      meta: { sizeBytes: backup.sizeBytes, totalRows: backup.totalRows },
    })
    return new NextResponse(new Uint8Array(backup.buffer), {
      status: 200,
      headers: {
        "content-type": "application/gzip",
        "content-disposition": `attachment; filename="${backup.filename}"`,
        "content-length": String(backup.sizeBytes),
        "cache-control": "no-store",
      },
    })
  } catch (err) {
    const status = err instanceof DomainError ? err.status : 500
    const message = err instanceof DomainError ? err.message : "خطا در ساخت پشتیبان"
    return NextResponse.json({ ok: false, error: { message } }, { status })
  }
}
