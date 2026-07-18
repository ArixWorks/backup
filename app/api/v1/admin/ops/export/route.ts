import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { getSeries } from "@/lib/monitoring/metrics"
import { metricDef } from "@/lib/monitoring/registry"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const RANGES: Record<string, number> = {
  "1h": 60 * 60_000,
  "6h": 6 * 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
}

type Row = { metric: string; time: string; value: number }

/**
 * GET /api/v1/admin/ops/export?format=csv|xlsx|pdf&metrics=a,b&range=24h
 * Streams a downloadable report of metric time-series. Heavy libs (xlsx/jspdf)
 * are imported lazily so they never bloat unrelated routes.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, error: { code: "FORBIDDEN" } }, { status: 403 })
  }

  const url = new URL(req.url)
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase()
  const rangeKey = url.searchParams.get("range") ?? "24h"
  const rangeMs = RANGES[rangeKey] ?? RANGES["24h"]
  const bucketMs = rangeMs / 96
  const metrics = (url.searchParams.get("metrics") ?? "system.cpu.usage,system.mem.usage,app.rps,app.error_rate")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 16)

  const rows: Row[] = []
  for (const name of metrics) {
    const series = await getSeries(name, rangeMs, bucketMs)
    const label = metricDef(name)?.label ?? name
    for (const p of series) rows.push({ metric: label, time: p.t, value: Number(p.value.toFixed(3)) })
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")

  if (format === "xlsx") {
    const { Workbook } = await import("exceljs")
    const workbook = new Workbook()
    workbook.creator = "ACCIRAN Operations Center"
    workbook.created = new Date()
    const worksheet = workbook.addWorksheet("Metrics")
    worksheet.columns = [
      { header: "Metric", key: "metric", width: 32 },
      { header: "Time", key: "time", width: 28 },
      { header: "Value", key: "value", width: 18 },
    ]
    worksheet.addRows(rows)
    worksheet.getRow(1).font = { bold: true }
    worksheet.autoFilter = "A1:C1"
    const buffer = await workbook.xlsx.writeBuffer()
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ops-metrics-${stamp}.xlsx"`,
      },
    })
  }

  if (format === "pdf") {
    const { jsPDF } = await import("jspdf")
    const autoTable = (await import("jspdf-autotable")).default
    const doc = new jsPDF({ orientation: "landscape" })
    doc.setFontSize(14)
    doc.text(`Operations Metrics Report (${rangeKey})`, 14, 16)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toISOString()}`, 14, 22)
    autoTable(doc, {
      head: [["Metric", "Time", "Value"]],
      body: rows.map((r) => [r.metric, r.time, String(r.value)]),
      startY: 28,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 30, 30] },
    })
    const buf = Buffer.from(doc.output("arraybuffer"))
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ops-metrics-${stamp}.pdf"`,
      },
    })
  }

  // Default: CSV
  const header = "metric,time,value\n"
  const csv =
    header +
    rows
      .map((r) => `${JSON.stringify(r.metric)},${r.time},${r.value}`)
      .join("\n")
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ops-metrics-${stamp}.csv"`,
    },
  })
}
