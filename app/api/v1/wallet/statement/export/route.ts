import { NextResponse } from "next/server"
import type { WalletTxType } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth/session"
import { queryStatementForExport } from "@/lib/core/statement"
import { BASE_CURRENCY } from "@/lib/core/ledger"
import { formatDateTime } from "@/lib/format"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TX_TYPES = new Set<string>([
  "DEPOSIT", "WITHDRAWAL", "FREEZE", "UNFREEZE", "PURCHASE", "REFUND",
  "BID_LOCK", "BID_RELEASE", "ADMIN_ADJUSTMENT", "CASHBACK", "REFERRAL_BONUS", "CONVERSION",
])

/** CSV cell escaper (handles commas, quotes, newlines). */
function csv(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Streams the filtered statement as a UTF-8 CSV download. */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const url = new URL(req.url)
  const typeParam = url.searchParams.get("type") ?? undefined
  const currency = url.searchParams.get("currency") || BASE_CURRENCY
  const rows = await queryStatementForExport({
    userId: user.id,
    currency,
    type: typeParam && TX_TYPES.has(typeParam) ? (typeParam as WalletTxType) : undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    q: url.searchParams.get("q") || undefined,
  })

  const header = ["تاریخ", "نوع", "ارز", "مبلغ", "موجودی پس از", "مسدودشده پس از", "مرجع", "شناسه مرجع", "توضیح"]
  const lines = [header.join(",")]
  for (const r of rows) {
    lines.push(
      [
        csv(formatDateTime(r.createdAt)),
        csv(r.type),
        csv(r.currency),
        csv(r.amount.toString()),
        csv(r.balanceAfter.toString()),
        csv(r.frozenAfter.toString()),
        csv(r.refType ?? ""),
        csv(r.refId ?? ""),
        csv(r.note ?? ""),
      ].join(","),
    )
  }
  // Prepend BOM so Excel reads UTF-8 (Persian) correctly.
  const body = "\uFEFF" + lines.join("\n")
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="statement-${currency}.csv"`,
    },
  })
}
