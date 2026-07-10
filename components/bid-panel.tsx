"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  proxyBidEnabled?: boolean
  onChanged: () => void
}

export function BidPanel({
  auctionId,
  minNextBid,
  buyNowPrice,
  minimumIncrement,
  status,
  proxyBidEnabled = false,
  onChanged,
}: Props) {
  const { user, refresh } = useSession()
  const { t } = useI18n()
  const router = useRouter()

  // Shared helper: show a top-up-focused error with a shortcut to the wallet,
  // so the user immediately understands they need to charge their account.
  function topUpToast(message: string) {
    toast.error(message, {
      action: { label: t("wallet.addFunds"), onClick: () => router.push("/wallet") },
    })
  }
  // Money crosses the API as BigInt-serialized *strings*. Coerce every value to
  // a Number up front so all arithmetic is numeric — otherwise `min + inc * n`
  // becomes string concatenation (e.g. "50000" + 10000 -> "5000010000").
  const minNext = Number(minNextBid) || 0
  const increment = Number(minimumIncrement) || 0
  const buyNow = buyNowPrice == null ? null : Number(buyNowPrice)
  const [amount, setAmount] = useState<string>(String(minNext))
  const [loading, setLoading] = useState(false)
  const [buying, setBuying] = useState(false)
  // Proxy / auto-bidding (PR5): optional ceiling the engine bids up to on the
  // user's behalf. Only offered when the auction policy enables it.
  const [useMax, setUseMax] = useState(false)
  const [maxAmount, setMaxAmount] = useState<string>("")

  useEffect(() => {
    setAmount(String(minNext))
  }, [minNext])

  const ended = status !== "ACTIVE"
  const available = user?.balances?.availableBalance ?? 0

  async function placeBid() {
    if (!user) return toast.error(t("buy.loginFirst"))
    const value = Number(amount)
    if (!Number.isFinite(value) || value < minNext) {
      return toast.error(t("bid.minBid", { amount: formatToman(minNext) }))
    }
    // Resolve an optional proxy ceiling. When enabled it must be >= the entered
    // bid, and the wallet must be able to cover the full ceiling (PR5 freezes
    // the entire max so the eventual winner is always fully funded).
    const proxyOn = proxyBidEnabled && useMax && maxAmount.trim() !== ""
    const maxValue = proxyOn ? Number(maxAmount) : null
    if (proxyOn) {
      if (!Number.isFinite(maxValue!) || maxValue! < value) {
        return toast.error(t("bid.maxTooLow"))
      }
    }
    const holdNeeded = maxValue ?? value
    // Guard against an insufficient wallet before hitting the server, so the
    // user gets an immediate, localized prompt to top up their account.
    if (available <= 0) {
      return topUpToast(t("bid.emptyBalance"))
    }
    if (holdNeeded > available) {
      return topUpToast(t("bid.insufficient", { amount: formatToman(holdNeeded - available) }))
    }
    setLoading(true)
    try {
      await apiPost(`/api/v1/auctions/${auctionId}/bids`, {
        amount: value,
        ...(maxValue != null ? { maxAmount: maxValue } : {}),
      })
      toast.success(proxyOn ? t("bid.maxPlaced") : t("bid.placed"))
      await Promise.all([refresh(), onChanged()])
    } catch (err) {
      // A race (balance changed between check and submit) surfaces as
      // INSUFFICIENT_FUNDS from the server — localize it and offer top-up.
      if (err instanceof ApiError && err.code === "INSUFFICIENT_FUNDS") {
        topUpToast(t("bid.needTopUp"))
      } else {
        toast.error(err instanceof ApiError ? err.message : t("bid.errPlace"))
      }
    } finally {
      setLoading(false)
    }
  }

  async function buyNowAction() {
    if (!user) return toast.error(t("buy.loginFirst"))
    // Same wallet guard for instant purchase: block early with a top-up prompt.
    if (buyNow != null && available < buyNow) {
      return topUpToast(available <= 0 ? t("bid.emptyBalance") : t("bid.needTopUp"))
    }
    setBuying(true)
    try {
      await apiPost(`/api/v1/auctions/${auctionId}/buy-now`)
      toast.success(t("bid.buyNowSuccess"))
      await Promise.all([refresh(), onChanged()])
    } catch (err) {
      if (err instanceof ApiError && err.code === "INSUFFICIENT_FUNDS") {
        topUpToast(t("bid.needTopUp"))
      } else {
        toast.error(err instanceof ApiError ? err.message : t("bid.errBuyNow"))
      }
    } finally {
      setBuying(false)
    }
  }

  // Adaptive quick-add tiers: multiples of the minimum increment. Always valid
  // (never below the minimum next bid) and scales with the increment size, so a
  // 5,000 increment offers +5k/+10k/+25k and a 50,000 one offers +50k/+100k/+250k.
  const quickTiers = [1, 2, 5]

  function setTo(value: number) {
    setAmount(String(Math.round(value)))
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
          <button
            type="button"
            onClick={() => setTo(minNext)}
            className="flex-1 rounded-md border border-border bg-secondary py-1.5 text-xs font-medium transition-colors hover:border-primary/40"
          >
            {t("bid.min")}
          </button>
          {quickTiers.map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setTo(minNext + increment * tier)}
              className="flex-1 rounded-md border border-border bg-secondary py-1.5 text-xs font-medium tabular-nums transition-colors hover:border-primary/40"
            >
              {`+${formatToman(increment * tier)}`}
            </button>
          ))}
        </div>
      </div>

      {proxyBidEnabled && (
        <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={useMax}
              onChange={(e) => setUseMax(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            {t("bid.enableMax")}
          </label>
          {useMax && (
            <>
              <Input
                inputMode="numeric"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder={t("bid.maxPlaceholder")}
                className="tabular-nums font-semibold"
                aria-label={t("bid.maxLabel")}
              />
              <p className="text-xs leading-5 text-muted-foreground">{t("bid.maxHint")}</p>
            </>
          )}
        </div>
      )}

      <Button onClick={placeBid} disabled={loading} className="w-full gap-2" size="lg">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
        {t("bid.submit")}
      </Button>

      {buyNow != null && (
        <Button
          onClick={buyNowAction}
          disabled={buying}
          variant="secondary"
          className="w-full gap-2"
          size="lg"
        >
          {buying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-primary" />}
          {t("bid.buyNow", { amount: `${formatToman(buyNow)} ${t("common.toman")}` })}
        </Button>
      )}

      <p className="text-center text-xs leading-5 text-muted-foreground">
        {t("bid.hint")}
      </p>
    </div>
  )
}
