"use client"

import { useState } from "react"
import useSWR from "swr"
import { ArrowDownLeft, ArrowUpRight, Download, Search, Filter } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMoney, formatDateTime } from "@/lib/format"

type Txn = {
  id: string
  type: string
  currency: string
  amount: number
  balanceAfter: number
  note: string | null
  createdAt: string
}

export const txnLabels: Record<string, string> = {
  DEPOSIT: "افزایش موجودی",
  WITHDRAWAL: "برداشت",
  FREEZE: "مسدودسازی",
  UNFREEZE: "آزادسازی",
  PURCHASE: "کسر بابت خرید",
  REFUND: "بازگشت وجه",
  BID_LOCK: "قفل پیشنهاد",
  BID_RELEASE: "آزادسازی پیشنهاد",
  ADMIN_ADJUSTMENT: "تعدیل مدیر",
  CASHBACK: "بازگشت نقدی",
  REFERRAL_BONUS: "پاداش دعوت",
  CONVERSION: "تبدیل ارز",
}

const POSITIVE = new Set(["DEPOSIT", "UNFREEZE", "REFUND", "CASHBACK", "REFERRAL_BONUS"])

const FILTER_TYPES = [
  { value: "ALL", label: "همه" },
  { value: "DEPOSIT", label: "افزایش موجودی" },
  { value: "WITHDRAWAL", label: "برداشت" },
  { value: "PURCHASE", label: "خرید" },
  { value: "REFUND", label: "بازگشت وجه" },
  { value: "CASHBACK", label: "بازگشت نقدی" },
  { value: "REFERRAL_BONUS", label: "پاداش دعوت" },
  { value: "CONVERSION", label: "تبدیل ارز" },
]

export function StatementPanel({
  currency,
  decimals,
  symbol,
}: {
  currency: string
  decimals: number
  symbol: string
}) {
  const [type, setType] = useState("ALL")
  const [q, setQ] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const params = new URLSearchParams({ currency, take: "100" })
  if (type !== "ALL") params.set("type", type)
  if (q.trim()) params.set("q", q.trim())
  if (from) params.set("from", from)
  if (to) params.set("to", to)

  const { data, isLoading } = useSWR<{ data: { transactions: Txn[]; total: number } }>(
    `/api/v1/wallet/statement?${params.toString()}`,
    fetcher,
    { keepPreviousData: true },
  )
  const txns = data?.data.transactions ?? []
  const total = data?.data.total ?? 0

  function exportCsv() {
    const p = new URLSearchParams({ currency, format: "csv" })
    if (type !== "ALL") p.set("type", type)
    if (q.trim()) p.set("q", q.trim())
    if (from) p.set("from", from)
    if (to) p.set("to", to)
    window.open(`/api/v1/wallet/statement/export?${p.toString()}`, "_blank")
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="font-bold">صورت‌حساب</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
          >
            <Filter className="h-4 w-4" />
            فیلتر
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="space-y-3 border-b border-border px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="جستجو در توضیحات یا مرجع..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pr-9"
          />
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">نوع تراکنش</label>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">از تاریخ</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">تا تاریخ</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">{total} تراکنش یافت شد</p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : txns.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">تراکنشی یافت نشد.</div>
      ) : (
        <ul className="divide-y divide-border">
          {txns.map((t) => {
            const positive = POSITIVE.has(t.type)
            return (
              <li key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      positive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {positive ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{txnLabels[t.type] ?? t.type}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="tabular-nums text-sm font-bold">
                    {formatMoney(t.amount, decimals)} {symbol}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {formatMoney(t.balanceAfter, decimals)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
