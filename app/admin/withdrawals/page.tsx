"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { ArrowDownToLine, Check, X, Loader2 } from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { formatToman, formatDateTime } from "@/lib/format"
import { StatusPill } from "@/components/admin/status-pill"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Withdrawal = {
  id: string
  amount: number
  status: string
  iban: string | null
  cardNumber: string | null
  note: string | null
  rejectReason: string | null
  createdAt: string
  user: { displayName: string; alias: string }
}

const filters = [
  { key: "PENDING", label: "در انتظار" },
  { key: "PAID", label: "پرداخت‌شده" },
  { key: "REJECTED", label: "ردشده" },
] as const

export default function WithdrawalsPage() {
  const [status, setStatus] = useState<string>("PENDING")
  const [busy, setBusy] = useState<string | null>(null)
  const { data, isLoading, mutate } = useSWR<{ data: Withdrawal[] }>(
    `/api/v1/admin/withdrawals?status=${status}`,
    fetcher,
    { refreshInterval: 12000 },
  )
  const rows = data?.data ?? []

  async function approve(id: string) {
    if (!window.confirm("پرداخت این برداشت را تأیید می‌کنید؟ مبلغ از کیف پول کسر می‌شود.")) return
    setBusy(id)
    try {
      await apiPost(`/api/v1/admin/withdrawals/${id}/approve`)
      toast.success("برداشت تأیید و از کیف پول کسر شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در تأیید برداشت")
    } finally {
      setBusy(null)
    }
  }

  async function reject(id: string) {
    const reason = window.prompt("دلیل رد درخواست (اختیاری):") ?? undefined
    setBusy(id)
    try {
      await apiPost(`/api/v1/admin/withdrawals/${id}/reject`, { reason })
      toast.success("درخواست رد و وجه آزاد شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در رد درخواست")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ArrowDownToLine className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">درخواست‌های برداشت</h1>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 text-sm">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
              status === f.key
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">درخواستی وجود ندارد.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">کاربر</TableHead>
                <TableHead className="text-right">مبلغ</TableHead>
                <TableHead className="text-right">مقصد واریز</TableHead>
                <TableHead className="text-right">تاریخ</TableHead>
                <TableHead className="text-right">وضعیت</TableHead>
                <TableHead className="text-left">اقدام</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <div className="font-medium">{w.user.displayName}</div>
                    <div className="text-xs text-muted-foreground">{w.user.alias}</div>
                  </TableCell>
                  <TableCell className="tabular-nums font-bold">{formatToman(w.amount)} ت</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground" dir="ltr">
                    {w.iban || w.cardNumber || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(w.createdAt)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={w.status} />
                    {w.rejectReason && (
                      <div className="mt-1 text-[11px] text-destructive">{w.rejectReason}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-left">
                    {w.status === "PENDING" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => approve(w.id)}
                          disabled={busy === w.id}
                          className="h-8 gap-1"
                        >
                          {busy === w.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          پرداخت شد
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reject(w.id)}
                          disabled={busy === w.id}
                          className="h-8 gap-1"
                        >
                          <X className="h-3.5 w-3.5" />
                          رد
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
