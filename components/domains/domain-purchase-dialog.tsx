"use client"

import { useEffect, useState } from "react"
import { Globe2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { AddFundsSheet } from "@/components/wallet/add-funds-sheet"
import { PaymentMethodCarousel, type PaymentCarouselItem } from "@/components/wallet/payment-method-carousel"
import type { DomainResult } from "@/components/domains/domain-results-carousel"
import type { DOMAIN_COPY } from "@/lib/i18n/domain-copy"

type DomainCopy = (typeof DOMAIN_COPY)[keyof typeof DOMAIN_COPY]
type Step = "confirm" | "payment"
type TopUpMethod = "CARD" | "TON" | "STARS"

/**
 * Domain checkout popup that mirrors the store/auction purchase UX: a confirm
 * step (domain + price summary) followed by the swipeable 3D payment-method
 * picker. Paying from the wallet delegates the actual quote+purchase to the
 * parent via `onPayWallet`; card/TON/Stars route to the wallet top-up sheet.
 */
export function DomainPurchaseDialog({
  domain,
  open,
  onOpenChange,
  copy,
  money,
  purchasing,
  onPayWallet,
}: {
  domain: DomainResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
  copy: DomainCopy
  money: (value: string | number) => string
  purchasing: boolean
  onPayWallet: () => void
}) {
  const { user, refresh } = useSession()
  const { t } = useI18n()
  const [step, setStep] = useState<Step>("confirm")
  const [payIndex, setPayIndex] = useState(0)
  const [addFundsOpen, setAddFundsOpen] = useState(false)
  const [topUpAllowed, setTopUpAllowed] = useState<TopUpMethod[]>(["CARD", "TON", "STARS"])

  const price = Number(domain?.price ?? 0)
  const balance = Number(user?.balances?.availableBalance ?? 0)
  const insufficient = price > balance

  // Reset to the confirm step whenever a new domain opens the dialog.
  useEffect(() => {
    if (open) {
      setStep("confirm")
      setPayIndex(0)
    }
  }, [open, domain?.key])

  // Warm the 3D gateway model pipeline as soon as the popup opens so the
  // payment carousel's WebGL icons are cached before the user advances.
  useEffect(() => {
    if (!open) return
    void import("@/components/wallet/gateway-model-3d")
      .then((m) => m.warmGatewayModels(["/pay-icons/3d/balance.glb", "/pay-icons/3d/card.glb", "/pay-icons/3d/ton.glb"]))
      .catch(() => {})
  }, [open])

  function openTopUp(methods: TopUpMethod[]) {
    setTopUpAllowed(methods)
    onOpenChange(false)
    setAddFundsOpen(true)
  }

  const ids = ["BALANCE", "CARD", "TON", "STARS"] as const
  const items: PaymentCarouselItem[] = [
    {
      id: "BALANCE",
      title: copy.payFromWallet,
      meta: insufficient ? undefined : money(balance),
      modelSrc: "/pay-icons/3d/balance.glb",
      disabled: insufficient,
      disabledHint: insufficient ? copy.insufficient : undefined,
    },
    { id: "CARD", title: t("wallet.methodCard"), modelSrc: "/pay-icons/3d/card.glb" },
    { id: "TON", title: t("wallet.methodTon"), subtitle: `${t("wallet.network")}: TON`, modelSrc: "/pay-icons/3d/ton.glb" },
    { id: "STARS", title: t("wallet.methodStars"), lottieSrc: "/pay-icons/lottie/glowing-star.json" },
  ]
  const active = ids[Math.min(payIndex, ids.length - 1)]

  function confirmPayment() {
    if (active === "BALANCE") {
      if (insufficient) openTopUp(["CARD", "TON", "STARS"])
      else onPayWallet()
    } else {
      openTopUp([active])
    }
  }

  const payLabel =
    active === "BALANCE"
      ? insufficient
        ? t("wallet.addFunds")
        : copy.payFromWallet
      : `${t("wallet.payWith")} ${items[payIndex]?.title ?? ""}`

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          {step === "confirm" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Globe2 className="size-5 text-primary" />
                  {copy.confirmTitle}
                </DialogTitle>
                <DialogDescription>{copy.confirmDescription}</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <div className="flex flex-col items-center gap-1 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <span dir="ltr" className="text-2xl font-black tracking-tight text-foreground">{domain?.display}</span>
                  <span className="text-xs font-medium text-muted-foreground">{copy.oneYear}</span>
                </div>
                <div className="space-y-1.5 rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                  <Row label={copy.summaryDomainLabel} value={domain?.display ?? ""} dir="ltr" />
                  <Row label={copy.summaryPeriodLabel} value={copy.oneYear} />
                  <Row label={copy.summaryTotalLabel} value={money(price)} strong />
                </div>
              </DialogBody>
              <DialogFooter>
                <Button className="w-full" onClick={() => setStep("payment")}>{copy.selectPaymentMethod}</Button>
              </DialogFooter>
            </>
          )}

          {step === "payment" && (
            <>
              <DialogHeader>
                <DialogTitle>{copy.paymentTitle}</DialogTitle>
                <DialogDescription>
                  <span dir="ltr" className="font-medium text-foreground">{domain?.display}</span> — {money(price)}
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-5">
                <PaymentMethodCarousel items={items} activeIndex={Math.min(payIndex, items.length - 1)} onActiveChange={setPayIndex} onSelect={confirmPayment} />
                <Button onClick={confirmPayment} disabled={purchasing} className="h-12 w-full text-base font-bold">
                  {purchasing ? <Loader2 className="size-5 animate-spin" /> : payLabel}
                </Button>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AddFundsSheet
        open={addFundsOpen}
        onOpenChange={setAddFundsOpen}
        onChanged={refresh}
        initialAmountToman={Math.max(0, Math.ceil(price - balance))}
        allowedMethods={topUpAllowed}
      />
    </>
  )
}

function Row({ label, value, strong, dir }: { label: string; value: string; strong?: boolean; dir?: "ltr" | "rtl" }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span dir={dir} className={strong ? "font-extrabold tabular-nums text-primary" : "tabular-nums"}>{value}</span>
    </div>
  )
}
