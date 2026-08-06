import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { toBackupCsv, toBackupJson } from "@/lib/core/domains/backup"

export const dynamic = "force-dynamic"

/**
 * Full backup of the TLD catalog.
 *
 * Usage: GET /api/v1/admin/domains/export?format=json|csv
 *
 * Not paginated on purpose: a backup that silently stopped at the admin table's
 * 25-row page would restore an almost-empty catalog. Orders are excluded, since
 * they are payment history rather than curated settings.
 */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json"
    const tlds = await prisma.domainTld.findMany({ orderBy: [{ displayOrder: "asc" }, { tld: "asc" }] })

    await audit({ actorId: admin.id, action: "domain.tld.export", entity: "DomainTld", meta: { count: tlds.length, format } })

    const stamp = new Date().toISOString().slice(0, 10)
    const filename = `domain-catalog-${stamp}.${format}`
    // UTF-8 BOM so Excel renders the Persian titles correctly.
    const body = format === "csv" ? `\uFEFF${toBackupCsv(tlds)}` : toBackupJson(tlds)

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500
    return new Response(JSON.stringify({ error: { message: (error as Error).message } }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
}
