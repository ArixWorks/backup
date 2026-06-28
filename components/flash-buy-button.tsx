"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ShoppingCart, Loader2, CheckCircle2, Minus, Plus, Wallet, Clock, Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiPost, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import type { FlashSale } from "@/components/flash-card"

type Step = "quantity" | "payment" | "done"

const COMING_SOON_GATEWAYS = ["Binance Pay", "USDT", "CryptoBot"] as const

export function FlashBuyButton({
  sale,
  onPurchased,
  fullWidth,
}: {
  sale: FlashSale
  onPurchased?: () => void
  fullWidth?: boolean
}) {
  const { user, refresh } = useSession()
  const { t, priceValue, currency } = useI18n()

  // Map backend coupon error codes (carried in the error message) to localized text.
  const COUPON_CODES = [
    "coupon.invalid",
    "coupon.expired",
    "coupon.notStarted",
    "coupon.minOrder",
    "coupon.exhausted",
    "coupon.userLimit",
  ] as const
  function tCoupon(code: string): string {
    return (COUPON_CODES as readonly string[]).includes(code)
      ? t(code as (typeof COUPON_CODES)[number])
      : t("coupon.invalid")
  }

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("quantity")
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ payload: string | null; status: string } | null>(null)
  // Coupon state
  const [couponInput, setCouponInput] = useState("")
  const [couponLoading, setCouponLoading] = useState(false)
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null)
  const soldOut = sale.stock <= 0

  const maxQty = useMemo(() => {
    const limit = sale.purchaseLimit ?? Infinity
    return Math.max(1, Math.min(sale.stock, limit))
  }, [sale.stock, sale.purchaseLimit])

  // Bulk-aware unit price mirrors the bot's priceFor() logic.
  const bulkApplies =
    !!sale.bulkMinQty && !!sale.bulkDiscountPercent && qty >= (sale.bulkMinQty ?? 0)
  const unitPrice = bulkApplies
    ? Math.round(sale.price * (1 - (sale.bulkDiscountPercent as number) / 100))
    : sale.price
  const subtotal = unitPrice * qty
  const discount = applied?.discount ?? 0
  const total = Math.max(0, subtotal - discount)

  const balance = Number(user?.balances?.availableBalance ?? 0)
  const insufficient = total > balance

  function start() {
    if (!user) {
      toast.error(t("buy.loginFirst"))
      return
    }
    setQty(1)
    setStep("quantity")
    setResult(null)
    setCouponInput("")
    setApplied(null)
    setOpen(true)
  }

  async function applyCoupon() {
    const code = couponInput.trim()
    if (!code) return
    setCouponLoading(true)
    try {
      const res = await apiPost("/api/v1/coupons/preview", {
        code,
        productId: sale.id,
        quantity: qty,
      })
      setApplied({ code: res.data.code, discount: Number(res.data.discount) })
      toast.success(t("coupon.applied"))
    } catch (err) {
      setApplied(null)
      const code = err instanceof ApiError ? err.message : "coupon.invalid"
      toast.error(tCoupon(code))
    } finally {
      setCouponLoading(false)
    }
  }

  function removeCoupon() {
    setApplied(null)
    setCouponInput("")
  }

  async function pay() {
    setLoading(true)
    try {
      const res = await apiPost(`/api/v1/flash-sales/${sale.id}/purchase`, {
        quantity: qty,
        ...(applied ? { couponCode: applied.code } : {}),
      })
      const order = res.data
      setResult({
        payload: order?.delivery?.payload ?? null,
        status: order?.delivery?.status ?? order?.status,
      })
      setStep("done")
      toast.success(t("buy.success"))
      await refresh()
      onPurchased?.()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("buy.insufficient"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        size={fullWidth ? "default" : "sm"}
        onClick={start}
        disabled={soldOut}
        className={fullWidth ? "w-full gap-1.5" : "gap-1.5"}
      >
        <ShoppingCart className="h-4 w-4" />
        {t("flash.buy")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {step === "quantity" && (
            <>
              <DialogHeader>
                <DialogTitle>{sale.title}</DialogTitle>
                <DialogDescription>{t("buy.quantity")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setQty((q) => Math.max(1, q - 1))
                      setApplied(null)
                    }}
                    disabled={qty <= 1}
                    aria-label="decrease"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[3ch] text-center text-3xl font-extrabold tabular-nums">
                    {qty}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setQty((q) => Math.min(maxQty, q + 1))
                      setApplied(null)
                    }}
                    disabled={qty >= maxQty}
                    aria-label="increase"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  {t("flash.stock")}: {sale.stock}
                </p>
                {bulkApplies && (
                  <p className="text-center text-xs font-medium text-success">
                    {t("buy.bulkHint")}: {sale.bulkDiscountPercent}%
                  </p>
                )}
                {/* Coupon entry */}
                <div className="space-y-2">
                  {applied ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-success/40 bg-success/10 p-2.5 text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-success">
                        <Tag className="h-4 w-4" />
                        {applied.code}
                      </span>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                        {t("coupon.remove")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder={t("coupon.placeholder")}
                        className="h-9 uppercase"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            applyCoupon()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={applyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="shrink-0"
                      >
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("coupon.apply")}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                  <Row label={t("buy.unitPrice")} value={`${priceValue(unitPrice)} ${currency}`} />
                  {discount > 0 && (
                    <>
                      <Row label={t("buy.subtotal")} value={`${priceValue(subtotal)} ${currency}`} />
                      <Row
                        label={t("coupon.discount")}
                        value={`- ${priceValue(discount)} ${currency}`}
                      />
                    </>
                  )}
                  <Row
                    label={t("buy.total")}
                    value={`${priceValue(total)} ${currency}`}
                    strong
                  />
                </div>
                <Button className="w-full" onClick={() => setStep("payment")}>
                  {t("buy.selectPayment")}
                </Button>
              </div>
            </>
          )}

          {step === "payment" && (
            <>
              <DialogHeader>
                <DialogTitle>{t("buy.selectPayment")}</DialogTitle>
                <DialogDescription>
                  {sale.title} — {priceValue(total)} {currency}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={pay}
                  disabled={loading || insufficient}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-start transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-out-quint)] hover:bg-primary/15 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex items-center gap-2 font-bold text-foreground">
                    <Wallet className="h-5 w-5 text-primary" />
                    {t("buy.payWallet")}
                  </span>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {priceValue(balance)} {currency}
                    </span>
                  )}
                </button>
                {insufficient && (
                  <p className="text-center text-xs text-destructive">{t("buy.insufficient")}</p>
                )}
                {COMING_SOON_GATEWAYS.map((g) => (
                  <div
                    key={g}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-4 opacity-60"
                  >
                    <span className="font-medium text-muted-foreground">{g}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {t("buy.comingSoon")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === "done" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  {t("buy.success")}
                </DialogTitle>
                <DialogDescription>{sale.title}</DialogDescription>
              </DialogHeader>
              {result?.payload ? (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">{t("buy.deliveryInfo")}</span>
                  <pre className="overflow-x-auto rounded-lg border border-border bg-secondary/60 p-3 text-left font-mono text-sm">
                    {result.payload}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("buy.pendingManual")}</p>
              )}
              <Button variant="gold" size="lg" className="mt-1 w-full" onClick={() => setOpen(false)}>
                {t("common.done")}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-extrabold text-primary tabular-nums" : "tabular-nums"}>
        {value}
      </span>
    </div>
  )
}
