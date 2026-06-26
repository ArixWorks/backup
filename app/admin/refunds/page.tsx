"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Undo2, Loader2, Check, X, ExternalLink, CreditCard, IdCard } from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatToman, formatDateTime } from "@/lib/format"
import { REFUND_STATUS_LABELS, REFUND_STATUS_TONE } from "@/lib/support-meta"

type Refund = {
  id: string
  publicId: string
  amount: number
  status: keyof typeof REFUND_STATUS_LABELS
  fullName: string
  nationalId: string
  nationalCardUrl: string
  cardNumber: string
  cardLast4: string
  iban: string | null
  reason: string | null
  rejectReason: string | null
  createdAt: string
  user: { displayName: string; alias: string }
}

const FILTERS = [
  { value: "PENDING", label: "در حال بررسی" },
  { value: "PAID", label: "پرداخت شده" },
  { value: "REJECTED", label: "رد شده" },
] as const

export default function AdminRefundsPage() {
  const [filter, setFilter] = useState<string>("PENDING")
  const { data, isLoading, mutate } = useSWR<{ data: Refund[] }>(
    `/api/v1/admin/refunds?status=${filter}`,
    fetcher,
    { refreshInterval: 10000 },
  )
  const [busyId, setBusyId] = useState<string | null>(null)

  const refunds = data?.data ?? []

  async function approve(id: string) {
    setBusyId(id)
    try {
      await apiPost(`/api/v1/admin/refunds/${id}/approve`)
      toast.success("بازگشت وجه تأیید و پرداخت شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در تأیید")
    } finally {
      setBusyId(null)
    }
  }

  async function reject(id: string) {
    const reason = window.prompt("دلیل رد درخواست (اختیاری):") ?? undefined
    setBusyId(id)
    try {
      await apiPost(`/api/v1/admin/refunds/${id}/reject`, { reason })
      toast.success("درخواست رد شد و مبلغ آزاد شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در رد درخواست")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Undo2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">مدیریت بازگشت وجه</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : refunds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          درخواستی در این وضعیت وجود ندارد.
        </div>
      ) : (
        <ul className="space-y-3">
          {refunds.map((r) => (
            <li key={r.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="tabular-nums text-lg font-extrabold">{formatToman(r.amount)} ت</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${REFUND_STATUS_TONE[r.status]}`}>
                  {REFUND_STATUS_LABELS[r.status]}
                </span>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <Info icon={<IdCard className="h-4 w-4" />} label="نام (کارت ملی)" value={r.fullName} />
                <Info icon={<IdCard className="h-4 w-4" />} label="کد ملی" value={r.nationalId} ltr />
                <Info icon={<CreditCard className="h-4 w-4" />} label="شماره کارت" value={r.cardNumber} ltr />
                {r.iban && <Info icon={<CreditCard className="h-4 w-4" />} label="شبا" value={r.iban} ltr />}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>کاربر: {r.user.displayName}</span>
                <span>{formatDateTime(r.createdAt)}</span>
                <a
                  href={r.nationalCardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  مشاهده تصویر کارت ملی
                </a>
              </div>

              {r.reason && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{r.reason}</p>}

              {r.status === "PENDING" && (
                <div className="flex gap-2">
                  <Button onClick={() => approve(r.id)} disabled={busyId === r.id} size="sm" className="flex-1 gap-1.5">
                    {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    تأیید و پرداخت
                  </Button>
                  <Button
                    onClick={() => reject(r.id)}
                    disabled={busyId === r.id}
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                  >
                    <X className="h-4 w-4" />
                    رد درخواست
                  </Button>
                </div>
              )}

              {r.rejectReason && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">دلیل رد: {r.rejectReason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Info({ icon, label, value, ltr }: { icon: React.ReactNode; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className={`truncate text-sm font-medium tabular-nums ${ltr ? "text-left" : ""}`} dir={ltr ? "ltr" : undefined}>
          {value}
        </div>
      </div>
    </div>
  )
}
