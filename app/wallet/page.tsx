"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import { Loader2, Plus, Crown, ChevronLeft } from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ReferralCard } from "@/components/referral-card"
import {
  BalancesPanel,
  type Balance,
  type CurrencyMeta,
} from "@/components/wallet/balances-panel"
import { StatementPanel } from "@/components/wallet/statement-panel"

type WalletData = {
  balances: { totalBalance: number; frozenBalance: number; availableBalance: number }
  allBalances: Balance[]
  currencies: CurrencyMeta[]
}

export default function WalletPage() {
  const { user, refresh } = useSession()
  const { data, isLoading, mutate } = useSWR<{ data: WalletData }>(
    user ? "/api/v1/wallet" : null,
    fetcher,
    { refreshInterval: 10000 },
  )

  const [selected, setSelected] = useState("IRT")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const currencies = data?.data.currencies ?? [
    { code: "IRT", name: "تومان", symbol: "تومان", decimals: 0 },
  ]
  const balances = data?.data.allBalances ?? []
  const selectedMeta = currencies.find((c) => c.code === selected) ?? currencies[0]

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
      <BalancesPanel
        balances={balances}
        currencies={currencies}
        loading={isLoading}
        selected={selected}
        onSelect={setSelected}
        onChanged={() => {
          mutate()
          refresh()
        }}
      />

      {selected === "IRT" && (
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
      )}

      <Link
        href="/rewards"
        className="card-premium active:scale-press flex items-center gap-3 rounded-2xl border border-primary/30 p-4 transition-colors"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <Crown className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground">باشگاه مشتریان و امتیازها</p>
          <p className="text-xs text-muted-foreground">سطح عضویت، مأموریت‌ها و دستاوردهای خود را ببینید</p>
        </div>
        <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      <ReferralCard />

      <StatementPanel
        currency={selected}
        decimals={selectedMeta?.decimals ?? 0}
        symbol={selectedMeta?.symbol ?? ""}
      />
    </div>
  )
}
