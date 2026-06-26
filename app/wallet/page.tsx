"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Wallet,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Plus,
} from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ReferralCard } from "@/components/referral-card"
import { formatToman, formatDateTime } from "@/lib/format"

type Txn = {
  id: string
  type: string
  amount: number
  balanceAfter: number
  reason: string | null
  createdAt: string
}

const txnLabels: Record<string, string> = {
  DEPOSIT: "افزایش موجودی",
  WITHDRAWAL: "برداشت",
  FREEZE: "مسدودسازی",
  UNFREEZE: "آزادسازی",
  CAPTURE: "کسر بابت خرید",
  PURCHASE: "کسر بابت خرید",
  REFUND: "بازگشت وجه",
  PAYOUT: "تسویه فروشنده",
  CASHBACK: "بازگشت نقدی",
  REFERRAL_BONUS: "پاداش دعوت",
}

export default function WalletPage() {
  const { user, refresh } = useSession()
  const { data, isLoading, mutate } = useSWR<{
    data: { balances: { totalBalance: number; frozenBalance: number; availableBalance: number }; transactions: Txn[] }
  }>(user ? "/api/v1/wallet" : null, fetcher, { refreshInterval: 10000 })

  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const balances = data?.data.balances
  const txns = data?.data.transactions ?? []

  async function topup() {
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 10000) {
      return toast.error("حداقل مبلغ شارژ ۱۰٬۰۰۰ تومان است")
    }
    setLoading(true)
    try {
      await apiPost("/api/v1/wallet/topup", { amount: value })
      toast.success("کیف پول شارژ شد")
      setAmount("")
      await Promise.all([mutate(), refresh()])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در شارژ کیف پول")
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        برای مشاهده کیف پول، یک حساب کاربری انتخاب کنید.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <Wallet className="h-5 w-5 text-primary" />
        کیف پول
      </h1>

      <BalanceCard
        label="موجودی قابل استفاده"
        value={balances?.availableBalance}
        loading={isLoading}
        accent
      />
      <div className="grid grid-cols-2 gap-3">
        <BalanceCard label="موجودی کل" value={balances?.totalBalance} loading={isLoading} />
        <BalanceCard
          label="مسدودشده در مزایده"
          value={balances?.frozenBalance}
          loading={isLoading}
          icon={<Lock className="h-4 w-4" />}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <Plus className="h-4 w-4 text-primary" />
          شارژ کیف پول (دمو)
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            inputMode="numeric"
            placeholder="مبلغ به تومان"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            className="tabular-nums"
          />
          <Button onClick={topup} disabled={loading} className="gap-2 sm:w-40">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            شارژ
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          در نسخه واقعی، شارژ از طریق کارت‌به‌کارت و تأیید مدیر انجام می‌شود.
        </p>
      </div>

      <ReferralCard />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 font-bold">تراکنش‌ها</div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : txns.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">تراکنشی ثبت نشده است.</div>
        ) : (
          <ul className="divide-y divide-border">
            {txns.map((t) => {
              const positive = ["DEPOSIT", "UNFREEZE", "REFUND", "PAYOUT", "CASHBACK", "REFERRAL_BONUS"].includes(t.type)
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
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(t.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span className="tabular-nums text-sm font-bold">
                    {formatToman(t.amount)} ت
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function BalanceCard({
  label,
  value,
  loading,
  accent,
  icon,
}: {
  label: string
  value?: number
  loading: boolean
  accent?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? "surface-glow border-primary/30 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <div className="mt-1 flex items-baseline gap-1">
          <span
            className={`font-extrabold tabular-nums ${accent ? "text-3xl text-primary" : "text-xl"}`}
          >
            {formatToman(value ?? 0)}
          </span>
          <span className="text-xs text-muted-foreground">تومان</span>
        </div>
      )}
    </div>
  )
}
