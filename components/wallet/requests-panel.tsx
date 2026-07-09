"use client"

import useSWR from "swr"
import { Clock, CheckCircle2, XCircle, Timer, CircleDashed } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMoney, formatDateTime } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

type DepositRequest = {
  id: string
  publicId: string
  amount: string | number
  method: "CARD" | "TON" | "USDT" | "STARS"
  status: "AWAITING_PAYMENT" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"
  rejectReason: string | null
  createdAt: string
}

// Drafts (AWAITING_PAYMENT) are abandoned instruction screens the user never
// confirmed — hide them so the panel only reflects real, submitted requests.
const VISIBLE = new Set(["PENDING", "APPROVED", "REJECTED", "EXPIRED"])

const STATUS_META: Record<
  string,
  { key: MessageKey; icon: typeof Clock; className: string }
> = {
  PENDING: { key: "wallet.statusPending", icon: Clock, className: "bg-warning/15 text-warning" },
  APPROVED: { key: "wallet.statusApproved", icon: CheckCircle2, className: "bg-success/15 text-success" },
  REJECTED: { key: "wallet.statusRejected", icon: XCircle, className: "bg-destructive/15 text-destructive" },
  EXPIRED: { key: "wallet.statusExpired", icon: Timer, className: "bg-muted text-muted-foreground" },
  AWAITING_PAYMENT: { key: "wallet.statusAwaiting", icon: CircleDashed, className: "bg-muted text-muted-foreground" },
}

export function RequestsPanel() {
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: DepositRequest[] }>(
    "/api/v1/wallet/deposits",
    fetcher,
    { refreshInterval: 15000 },
  )

  const all = data?.data ?? []
  const requests = all.filter((r) => VISIBLE.has(r.status))

  // Keep the wallet uncluttered: nothing to show until the user has a real request.
  if (isLoading) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <Skeleton className="h-5 w-40 rounded" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    )
  }
  if (requests.length === 0) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <span className="font-bold">{t("wallet.requestsTitle")}</span>
      </div>
      <ul className="divide-y divide-border">
        {requests.map((r) => {
          const meta = STATUS_META[r.status] ?? STATUS_META.PENDING
          const Icon = meta.icon
          return (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${meta.className}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold tabular-nums">
                      {formatMoney(r.amount)} {t("common.toman")}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}
                >
                  {t(meta.key)}
                </span>
              </div>
              {r.status === "REJECTED" && r.rejectReason && (
                <p className="rounded-xl bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive">
                  <span className="font-bold">{t("wallet.rejectReasonLabel")}: </span>
                  {r.rejectReason}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
