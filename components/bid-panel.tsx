"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Gavel, Loader2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiPost, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { formatToman } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"

type Props = {
  auctionId: string
  minNextBid: number
  buyNowPrice: number | null
  minimumIncrement: number
  status: string
  onChanged: () => void
}

export function BidPanel({
  auctionId,
  minNextBid,
  buyNowPrice,
  minimumIncrement,
  status,
  onChanged,
}: Props) {
  const { user, refresh } = useSession()
  const { t } = useI18n()
  const [amount, setAmount] = useState<string>(String(minNextBid))
  const [loading, setLoading] = useState(false)
  const [buying, setBuying] = useState(false)

  useEffect(() => {
    setAmount(String(minNextBid))
  }, [minNextBid])

  const ended = status !== "ACTIVE"
  const available = user?.balances?.availableBalance ?? 0

  async function placeBid() {
    if (!user) return toast.error(t("buy.loginFirst"))
    const value = Number(amount)
    if (!Number.isFinite(value) || value < minNextBid) {
      return toast.error(t("bid.minBid", { amount: formatToman(minNextBid) }))
    }
    setLoading(true)
    try {
      await apiPost(`/api/v1/auctions/${auctionId}/bids`, { amount: value })
      toast.success(t("bid.placed"))
      await Promise.all([refresh(), onChanged()])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("bid.errPlace"))
    } finally {
      setLoading(false)
    }
  }

  async function buyNow() {
    if (!user) return toast.error(t("buy.loginFirst"))
    setBuying(true)
    try {
      await apiPost(`/api/v1/auctions/${auctionId}/buy-now`)
      toast.success(t("bid.buyNowSuccess"))
      await Promise.all([refresh(), onChanged()])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("bid.errBuyNow"))
    } finally {
      setBuying(false)
    }
  }

  function bump(mult: number) {
    setAmount(String(minNextBid + minimumIncrement * mult))
  }

  if (ended) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
        {t("bid.notActive")}
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("wallet.available")}</span>
        <span className="tabular-nums font-medium">{formatToman(available)} {t("common.toman")}</span>
      </div>

      <div className="space-y-2">
        <label htmlFor="bid" className="text-sm font-medium">
          {t("bid.amountLabel")}
        </label>
        <Input
          id="bid"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          className="tabular-nums text-lg font-bold"
        />
        <div className="flex gap-2">
          {[0, 1, 2].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => bump(m)}
              className="flex-1 rounded-md border border-border bg-secondary py-1.5 text-xs font-medium transition-colors hover:border-primary/40"
            >
              {m === 0 ? t("bid.min") : `+${formatToman(minimumIncrement * m)}`}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={placeBid} disabled={loading} className="w-full gap-2" size="lg">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
        {t("bid.submit")}
      </Button>

      {buyNowPrice != null && (
        <Button
          onClick={buyNow}
          disabled={buying}
          variant="secondary"
          className="w-full gap-2"
          size="lg"
        >
          {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-primary" />}
          {t("bid.buyNow", { amount: `${formatToman(buyNowPrice)} ${t("common.toman")}` })}
        </Button>
      )}

      <p className="text-center text-xs leading-5 text-muted-foreground">
        {t("bid.hint")}
      </p>
    </div>
  )
}
