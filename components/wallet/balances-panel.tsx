"use client"

import { Lock, Wallet } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMoney } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"

export type CurrencyMeta = { code: string; name: string; symbol: string; decimals: number }
export type Balance = {
  currency: string
  totalBalance: number
  frozenBalance: number
  availableBalance: number
}
export function BalancesPanel({
  balances,
  currencies,
  loading,
  selected,
  onSelect,
}: {
  balances: Balance[]
  currencies: CurrencyMeta[]
  loading: boolean
  selected: string
  onSelect: (code: string) => void
}) {
  const { t, errorMessage } = useI18n()
  const meta = currencies.find((c) => c.code === selected)
  const decimals = meta?.decimals ?? 0
  const current =
    balances.find((b) => b.currency === selected) ??
    { currency: selected, totalBalance: 0, frozenBalance: 0, availableBalance: 0 }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-extrabold">{t("wallet.title")}</h1>
        </div>
        {currencies.length > 1 && (
          <Select value={selected} onValueChange={(v) => v && onSelect(v)}>
            <SelectTrigger className="w-32" aria-label={t("wallet.selectCurrency")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <BalanceCard
        label={t("wallet.available")}
        value={current.availableBalance}
        symbol={meta?.symbol ?? ""}
        decimals={decimals}
        loading={loading}
        accent
      />
      <div className="grid grid-cols-2 gap-3">
        <BalanceCard
          label={t("wallet.total")}
          value={current.totalBalance}
          symbol={meta?.symbol ?? ""}
          decimals={decimals}
          loading={loading}
        />
        <BalanceCard
          label={t("wallet.frozenShort")}
          value={current.frozenBalance}
          symbol={meta?.symbol ?? ""}
          decimals={decimals}
          loading={loading}
          icon={<Lock className="h-4 w-4" />}
        />
      </div>

    </div>
  )
}

function BalanceCard({
  label,
  value,
  symbol,
  decimals,
  loading,
  accent,
  icon,
}: {
  label: string
  value: number
  symbol: string
  decimals: number
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
            {formatMoney(value, decimals)}
          </span>
          <span className="text-xs text-muted-foreground">{symbol}</span>
        </div>
      )}
    </div>
  )
}
