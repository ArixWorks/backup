"use client"

import useSWR from "swr"
import { ReceiptText, ArrowDownLeft } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { EmptyState, SignInRequired } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { formatToman, formatDateTime } from "@/lib/format"
import { DEPOSIT_STATUS_TONE } from "@/lib/support-meta"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

type DepositStatus = "PENDING" | "APPROVED" | "REJECTED"

const DEPOSIT_STATUS_KEY: Record<DepositStatus, MessageKey> = {
  PENDING: "depositStatus.PENDING",
  APPROVED: "depositStatus.APPROVED",
  REJECTED: "depositStatus.REJECTED",
}

type Deposit = {
  id: string
  amount: number
  status: DepositStatus
  cardLast4: string | null
  reference: string | null
  createdAt: string
}

export default function ReportsPage() {
  const { user } = useSession()
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: Deposit[] }>(
    user ? "/api/v1/wallet/deposits" : null,
    fetcher,
  )

  const deposits = data?.data ?? []

  if (!user) {
    return <SignInRequired description={t("reports.signInRequired")} />
  }

  return (
    <div className="space-y-5">
      <PageHeader icon={ReceiptText} title={t("reports.title")} description={t("reports.subtitle")} />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : deposits.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={t("reports.empty")}
          description={t("reports.emptyDesc")}
          actionLabel={t("reports.emptyAction")}
          actionHref="/wallet"
        />
      ) : (
        <ul className="space-y-2">
          {deposits.map((d) => (
            <li key={d.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success">
                    <ArrowDownLeft className="h-4 w-4" />
                  </span>
                  <div className="flex flex-col">
                    <span className="tabular-nums text-base font-extrabold">{formatToman(d.amount)} {t("common.toman")}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</span>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${DEPOSIT_STATUS_TONE[d.status]}`}>
                  {t(DEPOSIT_STATUS_KEY[d.status])}
                </span>
              </div>
              {(d.cardLast4 || d.reference) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {d.cardLast4 && <span dir="ltr">{t("reports.card")} •••• {d.cardLast4}</span>}
                  {d.reference && <span>{t("reports.reference")} {d.reference}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
