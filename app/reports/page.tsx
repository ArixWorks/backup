"use client"

import useSWR from "swr"
import { ReceiptText, ArrowDownLeft } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { EmptyState, SignInRequired } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { formatToman, formatDateTime } from "@/lib/format"
import { DEPOSIT_STATUS_LABELS, DEPOSIT_STATUS_TONE } from "@/lib/support-meta"

type Deposit = {
  id: string
  amount: number
  status: keyof typeof DEPOSIT_STATUS_LABELS
  cardLast4: string | null
  reference: string | null
  createdAt: string
}

export default function ReportsPage() {
  const { user } = useSession()
  const { data, isLoading } = useSWR<{ data: Deposit[] }>(
    user ? "/api/v1/wallet/deposits" : null,
    fetcher,
  )

  const deposits = data?.data ?? []

  if (!user) {
    return <SignInRequired description="برای مشاهده گزارش واریزها، ابتدا وارد حساب کاربری خود شوید." />
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <ReceiptText className="h-5 w-5 text-primary" />
          گزارش واریزها
        </h1>
        <p className="text-sm text-muted-foreground">تاریخچه درخواست‌های شارژ کیف پول و وضعیت بررسی آن‌ها.</p>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : deposits.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="هنوز واریزی ثبت نشده است"
          description="برای شارژ کیف پول از صفحه کیف پول اقدام کنید."
          actionLabel="شارژ کیف پول"
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
                    <span className="tabular-nums text-base font-extrabold">{formatToman(d.amount)} ت</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</span>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${DEPOSIT_STATUS_TONE[d.status]}`}>
                  {DEPOSIT_STATUS_LABELS[d.status]}
                </span>
              </div>
              {(d.cardLast4 || d.reference) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {d.cardLast4 && <span dir="ltr">کارت •••• {d.cardLast4}</span>}
                  {d.reference && <span>کد پیگیری: {d.reference}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
