"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ShoppingCart, Loader2, CheckCircle2, Minus, Plus, Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiPost, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import type { FlashSale, PlanVariant } from "@/components/flash-card"
import { CelebrationOverlay } from "@/components/celebration-overlay"
import { AddFundsSheet } from "@/components/wallet/add-funds-sheet"
import { PaymentMethodCarousel, type PaymentCarouselItem } from "@/components/wallet/payment-method-carousel"

type Step = "quantity" | "payment" | "done"

type TopUpMethod = "CARD" | "TON" | "STARS"

export function FlashBuyButton({
  sale,
  variant,
  onPurchased,
  fullWidth,
  disabled,
}: {
  sale: FlashSale
  /** When set, purchase targets this specific sale plan (price/stock/limit). */
  variant?: PlanVariant | null
  onPurchased?: () => void
  fullWidth?: boolean
  disabled?: boolean
}) {
  const { user, refresh } = useSession()
  const { t, priceValue, currency, errorMessage } = useI18n()

  // The chosen plan is the source of truth for price/stock/limit when present;
  // otherwise fall back to the product-level fixed sale (legacy single-plan).
  const effPrice = Number(variant ? variant.price : sale.price)
  const effStock = variant ? variant.stock : sale.stock
  const effLimit = variant ? variant.purchaseLimit : sale.purchaseLimit

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
  const [addFundsOpen, setAddFundsOpen] = useState(false)
  const [payIndex, setPayIndex] = useState(0)
  const [topUpAllowed, setTopUpAllowed] = useState<TopUpMethod[]>(["CARD", "TON", "STARS"])
  const [celebrating, setCelebrating] = useState(false)
  const [step, setStep] = useState<Step>("quantity")
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ payload: string | null; status: string } | null>(null)
  // Coupon state
  const [couponInput, setCouponInput] = useState("")
  const [couponLoading, setCouponLoading] = useState(false)
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null)
  const soldOut = effStock <= 0

  const maxQty = useMemo(() => {
    const limit = effLimit ?? Infinity
    return Math.max(1, Math.min(effStock, limit))
  }, [effStock, effLimit])

  // Bulk-aware unit price mirrors the bot's priceFor() logic. Bulk discount is a
  // product-level config that applies on top of the chosen plan's unit price.
  const bulkApplies =
    !!sale.bulkMinQty && !!sale.bulkDiscountPercent && qty >= (sale.bulkMinQty ?? 0)
  const unitPrice = bulkApplies
    ? Math.round(effPrice * (1 - (sale.bulkDiscountPercent as number) / 100))
    : effPrice
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
    setPayIndex(0)
    setTopUpAllowed(["CARD", "TON", "STARS"])
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
        ...(variant ? { variantId: variant.id } : {}),
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

  function openTopUp() {
    setOpen(false)
    setAddFundsOpen(true)
  }

  async function pay() {
    setLoading(true)
    try {
      const res = await apiPost(`/api/v1/flash-sales/${sale.id}/purchase`, {
        quantity: qty,
        ...(variant ? { variantId: variant.id } : {}),
        ...(applied ? { couponCode: applied.code } : {}),
      })
      const order = res.data
      setResult({
        payload: order?.delivery?.payload ?? null,
        status: order?.delivery?.status ?? order?.status,
      })
      setStep("done")
      setOpen(false)
      setCelebrating(true)
      toast.success(t("buy.success"))
      await refresh()
      onPurchased?.()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        size={fullWidth ? "default" : "sm"}
        onClick={start}
        disabled={soldOut || disabled}
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
              <DialogBody className="space-y-4">
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
                  {variant ? `${variant.name} — ` : ""}
                  {t("flash.stock")}: {effStock}
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
                          if (e.nativeEvent.isComposing || e.keyCode === 229) return
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
              </DialogBody>
              <DialogFooter>
                <Button className="w-full" onClick={() => setStep("payment")}>
                  {t("buy.selectPayment")}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "payment" && (
            <PaymentStep
              t={t}
              title={sale.title}
              totalLabel={`${priceValue(total)} ${currency}`}
              balanceLabel={`${priceValue(balance)} ${currency}`}
              insufficient={insufficient}
              loading={loading}
              activeIndex={payIndex}
              onActiveChange={setPayIndex}
              onPay={pay}
              onTopUp={(methods) => {
                setTopUpAllowed(methods)
                openTopUp()
              }}
            />
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
              <DialogBody>
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
              </DialogBody>
              <DialogFooter>
                <Button variant="gold" size="lg" className="w-full" onClick={() => setOpen(false)}>
                  {t("common.done")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <AddFundsSheet
        open={addFundsOpen}
        onOpenChange={setAddFundsOpen}
        onChanged={refresh}
        initialAmountToman={Math.max(0, Math.ceil(total - balance))}
        allowedMethods={topUpAllowed}
      />
      <CelebrationOverlay
        open={celebrating}
        kind="purchase"
        subject={sale.title}
        image={sale.coverImage}
        actionHref="/orders"
        onClose={() => setCelebrating(false)}
      />
    </>
  )
}

function PaymentStep({
  t,
  title,
  totalLabel,
  balanceLabel,
  insufficient,
  loading,
  activeIndex,
  onActiveChange,
  onPay,
  onTopUp,
}: {
  t: ReturnType<typeof useI18n>["t"]
  title: string
  totalLabel: string
  balanceLabel: string
  insufficient: boolean
  loading: boolean
  activeIndex: number
  onActiveChange: (index: number) => void
  onPay: () => void
  onTopUp: (methods: TopUpMethod[]) => void
}) {
  const ids = ["BALANCE", "CARD", "TON", "STARS"] as const
  const items: PaymentCarouselItem[] = [
    {
      id: "BALANCE",
      title: t("buy.payWallet"),
      meta: insufficient ? undefined : balanceLabel,
      modelSrc: "/pay-icons/3d/balance.glb",
      disabled: insufficient,
      disabledHint: insufficient ? t("buy.insufficient") : undefined,
    },
    { id: "CARD", title: t("wallet.methodCard"), modelSrc: "/pay-icons/3d/card.glb" },
    { id: "TON", title: t("wallet.methodTon"), subtitle: `${t("wallet.network")}: TON`, modelSrc: "/pay-icons/3d/ton.glb" },
    { id: "STARS", title: t("wallet.methodStars"), modelSrc: "/pay-icons/3d/stars.glb" },
  ]

  const active = ids[Math.min(activeIndex, ids.length - 1)]

  function confirm() {
    if (active === "BALANCE") {
      if (insufficient) onTopUp(["CARD", "TON", "STARS"])
      else onPay()
    } else {
      onTopUp([active])
    }
  }

  const label =
    active === "BALANCE"
      ? insufficient
        ? t("wallet.addFunds")
        : t("buy.payWallet")
      : `${t("wallet.payWith")} ${items[activeIndex]?.title ?? ""}`

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("buy.selectPayment")}</DialogTitle>
        <DialogDescription>
          {title} — {totalLabel}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-5">
        <PaymentMethodCarousel
          items={items}
          activeIndex={Math.min(activeIndex, items.length - 1)}
          onActiveChange={onActiveChange}
          onSelect={confirm}
        />
        <Button onClick={confirm} disabled={loading} className="h-12 w-full text-base font-bold">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : label}
        </Button>
      </DialogBody>
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
