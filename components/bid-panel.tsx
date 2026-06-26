"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Gavel, Loader2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiPost, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { formatToman } from "@/lib/format"

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
  const [amount, setAmount] = useState<string>(String(minNextBid))
  const [loading, setLoading] = useState(false)
  const [buying, setBuying] = useState(false)

  useEffect(() => {
    setAmount(String(minNextBid))
  }, [minNextBid])

  const ended = status !== "ACTIVE"
  const available = user?.balances?.availableBalance ?? 0

  async function placeBid() {
    if (!user) return toast.error("ابتدا یک حساب کاربری انتخاب کنید")
    const value = Number(amount)
    if (!Number.isFinite(value) || value < minNextBid) {
      return toast.error(`حداقل پیشنهاد ${formatToman(minNextBid)} تومان است`)
    }
    setLoading(true)
    try {
      await apiPost(`/api/v1/auctions/${auctionId}/bids`, { amount: value })
      toast.success("پیشنهاد شما ثبت شد")
      await Promise.all([refresh(), onChanged()])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ثبت پیشنهاد")
    } finally {
      setLoading(false)
    }
  }

  async function buyNow() {
    if (!user) return toast.error("ابتدا یک حساب کاربری انتخاب کنید")
    setBuying(true)
    try {
      await apiPost(`/api/v1/auctions/${auctionId}/buy-now`)
      toast.success("محصول با خرید فوری برای شما ثبت شد")
      await Promise.all([refresh(), onChanged()])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در خرید فوری")
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
        این مزایده فعال نیست.
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">موجودی قابل استفاده</span>
        <span className="tabular-nums font-medium">{formatToman(available)} تومان</span>
      </div>

      <div className="space-y-2">
        <label htmlFor="bid" className="text-sm font-medium">
          مبلغ پیشنهاد (تومان)
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
              {m === 0 ? "حداقل" : `+${formatToman(minimumIncrement * m)}`}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={placeBid} disabled={loading} className="w-full gap-2" size="lg">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
        ثبت پیشنهاد
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
          خرید فوری با {formatToman(buyNowPrice)} تومان
        </Button>
      )}

      <p className="text-center text-xs leading-5 text-muted-foreground">
        با ثبت پیشنهاد، تنها اختلاف مبلغ نسبت به پیشنهاد قبلی شما از موجودی مسدود می‌شود.
      </p>
    </div>
  )
}
