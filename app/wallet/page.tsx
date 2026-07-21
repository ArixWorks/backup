"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Plus, Crown, ChevronLeft } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { SignInRequired } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { ReferralCard } from "@/components/referral-card"
import {
  BalancesPanel,
  type Balance,
  type CurrencyMeta,
} from "@/components/wallet/balances-panel"
import { StatementPanel } from "@/components/wallet/statement-panel"
import { AddFundsSheet } from "@/components/wallet/add-funds-sheet"
import { RequestsPanel } from "@/components/wallet/requests-panel"
import { RejectionWatcher } from "@/components/wallet/rejection-watcher"

type WalletData = {
  balances: { totalBalance: number; frozenBalance: number; availableBalance: number }
  allBalances: Balance[]
  currencies: CurrencyMeta[]
}

export default function WalletPage() {
  const { user, refresh } = useSession()
  const { t } = useI18n()
  const { data, isLoading, mutate } = useSWR<{ data: WalletData }>(
    user ? "/api/v1/wallet" : null,
    fetcher,
    { refreshInterval: 10000 },
  )

  const [selected, setSelected] = useState("IRT")
  const [addOpen, setAddOpen] = useState(false)

  const currencies = (data?.data.currencies ?? [
    { code: "IRT", name: t("common.toman"), symbol: t("common.toman"), decimals: 0 },
  ]).map((currency) => currency.code === "IRT"
    ? { ...currency, name: t("common.toman"), symbol: t("common.toman") }
    : currency)
  const balances = data?.data.allBalances ?? []
  const selectedMeta = currencies.find((c) => c.code === selected) ?? currencies[0]

  function refreshAll() {
    mutate()
    refresh()
  }

  if (!user) {
    return <SignInRequired description={t("wallet.signInRequired")} />
  }

  return (
    <div className="space-y-5 web:lg:grid web:lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] web:lg:items-start web:lg:gap-6 web:lg:space-y-0">
      {/* Left column: balances + primary actions (identity of the wallet). */}
      <div className="space-y-5">
        <BalancesPanel
          balances={balances}
          currencies={currencies}
          loading={isLoading}
          selected={selected}
          onSelect={setSelected}
        />

        <Button
          onClick={() => setAddOpen(true)}
          className="h-14 w-full gap-2 rounded-2xl text-base font-bold shadow-sm"
        >
          <Plus className="h-5 w-5" />
          {t("wallet.addFunds")}
        </Button>

        <RequestsPanel />

        <Link
          href="/rewards"
          className="card-premium active:scale-press flex items-center gap-3 rounded-2xl border border-primary/30 p-4 transition-colors"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
            <Crown className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground">{t("wallet.rewardsTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("wallet.rewardsSubtitle")}</p>
          </div>
          <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground rtl:rotate-180" />
        </Link>

        <ReferralCard />
      </div>

      {/* Right column: full transaction statement, given the room to breathe. */}
      <StatementPanel
        currency={selected}
        decimals={selectedMeta?.decimals ?? 0}
        symbol={selectedMeta?.symbol ?? ""}
      />

      <AddFundsSheet open={addOpen} onOpenChange={setAddOpen} onChanged={refreshAll} />

      {/* Surfaces admin rejections as a blocking alert, then refreshes balances. */}
      <RejectionWatcher onAcknowledged={refreshAll} />
    </div>
  )
}
