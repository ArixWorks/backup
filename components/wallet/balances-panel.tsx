"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Lock, Loader2, ArrowLeftRight, Wallet } from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatMoney } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"

export type CurrencyMeta = { code: string; name: string; symbol: string; decimals: number }
export type Balance = {
  currency: string
  totalBalance: number
  frozenBalance: number
  availableBalance: number
}
type RateRow = { from: string; to: string; rate: string }

const RATE_SCALE = 100_000_000

export function BalancesPanel({
  balances,
  currencies,
  loading,
  selected,
  onSelect,
  onChanged,
}: {
  balances: Balance[]
  currencies: CurrencyMeta[]
  loading: boolean
  selected: string
  onSelect: (code: string) => void
  onChanged: () => void
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

      {currencies.length > 1 && (
        <ConvertDialog
          currencies={currencies}
          balances={balances}
          defaultFrom={selected}
          onDone={onChanged}
        />
      )}
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

function ConvertDialog({
  currencies,
  balances,
  defaultFrom,
  onDone,
}: {
  currencies: CurrencyMeta[]
  balances: Balance[]
  defaultFrom: string
  onDone: () => void
}) {
  const { t, errorMessage } = useI18n()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(currencies.find((c) => c.code !== defaultFrom)?.code ?? defaultFrom)
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const { data: ratesData } = useSWR<{ data: { rates: RateRow[] } }>(
    open ? "/api/v1/currencies" : null,
    fetcher,
  )
  const rates = useMemo(() => ratesData?.data.rates ?? [], [ratesData?.data.rates])

  const fromMeta = currencies.find((c) => c.code === from)
  const toMeta = currencies.find((c) => c.code === to)
  const rate = useMemo(() => {
    const r = rates.find((x) => x.from === from && x.to === to)
    return r ? Number(r.rate) / RATE_SCALE : null
  }, [rates, from, to])

  // Convert the entered major-unit amount to minor units for preview.
  const minorAmount = amount ? Math.round(Number(amount) * 10 ** (fromMeta?.decimals ?? 0)) : 0
  const previewMinor = rate != null ? Math.floor(minorAmount * rate) : 0

  async function submit() {
    if (!minorAmount || minorAmount <= 0) return toast.error(t("convert.enterAmount"))
    if (from === to) return toast.error(t("convert.sameCurrency"))
    setLoading(true)
    try {
      await apiPost("/api/v1/wallet/convert", { from, to, amount: minorAmount })
      toast.success(t("convert.success"))
      setAmount("")
      setOpen(false)
      onDone()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="w-full gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            {t("convert.button")}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("convert.button")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("convert.from")}</label>
              <Select value={from} onValueChange={(v) => v && setFrom(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("convert.to")}</label>
              <Select value={to} onValueChange={(v) => v && setTo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              {t("convert.amountLabel", { symbol: fromMeta?.symbol ?? "" })}
            </label>
            <Input
              inputMode="decimal"
              placeholder={t("convert.amountPlaceholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="tabular-nums"
            />
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            {rate == null ? (
              <span className="text-muted-foreground">{t("convert.rateUnavailable")}</span>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("convert.approxReceive")}</span>
                <span className="font-bold tabular-nums">
                  {formatMoney(previewMinor, toMeta?.decimals ?? 0)} {toMeta?.symbol}
                </span>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={submit} disabled={loading || rate == null} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
            {t("convert.button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
