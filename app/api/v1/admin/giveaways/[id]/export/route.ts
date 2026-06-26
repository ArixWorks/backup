import { requireAdmin } from "@/lib/auth/session"
import { getGiveawayExport, type ExportRow } from "@/lib/core/giveaway"

export const dynamic = "force-dynamic"

/** RFC-4180 cell escaping: wrap in quotes and double any embedded quotes. */
function cell(value: string | number): string {
  const s = String(value ?? "")
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const lines = [headers.join(",")]
  for (const r of rows) lines.push(headers.map((h) => cell(r[h])).join(","))
  return lines.join("\r\n")
}

// Admin CSV export of a giveaway's participants or winners.
// Usage: GET /api/v1/admin/giveaways/<id>/export?type=participants|winners
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const type = new URL(req.url).searchParams.get("type") === "winners" ? "winners" : "participants"
    const { rows } = await getGiveawayExport(id, type)

    // UTF-8 BOM so Excel renders Persian text correctly.
    const body = "\uFEFF" + toCsv(rows)
    const filename = `giveaway-${id}-${type}.csv`
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500
    return new Response(JSON.stringify({ error: { message: (e as Error).message } }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
}
