"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import useSWR from "swr"
import { toast } from "sonner"
import { motion } from "motion/react"
import {
  Loader2,
  CreditCard,
  Copy,
  Check,
  Upload,
  ChevronLeft,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react"
import { fetcher, apiPost, apiPatch, ApiError } from "@/lib/api-client"
import { uploadFile } from "@/lib/upload-client"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { formatMoney, formatCountdown, msUntil } from "@/lib/format"

type MethodConfig = {
  method: "CARD" | "TON" | "USDT" | "STARS"
  enabled: boolean
  address: string | null
  holder?: string | null
  bank?: string | null
  network?: string | null
}
type PaymentConfig = { minToman: number; methods: MethodConfig[] }

type Instructions = {
  id: string
  publicId: string
  method: "CARD" | "TON" | "USDT" | "STARS"
  amount: string | number
  payCurrency: string
  payAmount: string | number
  payAddress: string | null
  payNetwork: string | null
  payTag: string | null
  expiresAt: string | null
  status: string
}

const METHOD_ICON: Record<string, { src?: string; lucide?: boolean }> = {
  CARD: { lucide: true },
  USDT: { src: "/pay-icons/tether.svg" },
  TON: { src: "/pay-icons/ton.svg" },
  STARS: { src: "/pay-icons/telegram.svg" },
}

const PAY_DECIMALS: Record<string, number> = { IRT: 0, USDT: 2, TON: 2, XTR: 0 }

type Step = "amount" | "method" | "pay" | "stars" | "done"

export function AddFundsSheet({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onChanged: () => void
}) {
  const { t, locale } = useI18n()
  const { data: cfg } = useSWR<{ data: PaymentConfig }>(
    open ? "/api/v1/wallet/payment-config" : null,
    fetcher,
  )
  // USD rate for non-fa locales that think in dollars (converted to Toman before send).
  const { data: pub } = useSWR<{ data: { usdRate: number } }>(
    open ? "/api/v1/public/config" : null,
    fetcher,
  )

  const isToman = locale === "fa"
  const usdRate = pub?.data?.usdRate ?? 100000
  const methods = cfg?.data?.methods ?? []
  const minToman = cfg?.data?.minToman ?? 10000

  const [step, setStep] = useState<Step>("amount")
  const [input, setInput] = useState("")
  const [method, setMethod] = useState<MethodConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [instructions, setInstructions] = useState<Instructions | null>(null)

  // Reset everything when the sheet closes.
  useEffect(() => {
    if (!open) {
      setStep("amount")
      setInput("")
      setMethod(null)
      setInstructions(null)
      setBusy(false)
    }
  }, [open])

  // The wallet credit amount, always expressed in Toman (IRT base unit).
  const tomanAmount = useMemo(() => {
    const n = Number(input)
    if (!Number.isFinite(n) || n <= 0) return 0
    return isToman ? Math.round(n) : Math.round(n * usdRate)
  }, [input, isToman, usdRate])

  const amountChips = isToman ? [50000, 100000, 200000, 500000] : [5, 10, 25, 50]

  function goMethod() {
    if (tomanAmount < minToman) {
      toast.error(`${t("wallet.minTopup")}: ${formatMoney(minToman)} ${t("common.toman")}`)
      return
    }
    setStep("method")
  }

  async function chooseMethod(m: MethodConfig) {
    if (!m.enabled) return toast.error(t("wallet.methodUnavailable"))
    setMethod(m)
    setBusy(true)
    try {
      if (m.method === "STARS") {
        const res = await apiPost<{ data: { invoiceUrl: string; stars: number } }>(
          "/api/v1/wallet/deposits/stars",
          { amount: tomanAmount },
        )
        const url = res.data.invoiceUrl
        const wa = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined
        if (wa?.openInvoice) {
          wa.openInvoice(url, (status: string) => {
            if (status === "paid") {
              toast.success(t("wallet.depositCreated"))
              onChanged()
              onOpenChange(false)
            }
          })
        } else {
          window.open(url, "_blank")
          toast.success(t("wallet.payWithStars"))
        }
        setBusy(false)
        return
      }
      const res = await apiPost<{ data: Instructions }>("/api/v1/wallet/deposits", {
        amount: tomanAmount,
        method: m.method,
      })
      setInstructions(res.data)
      setStep("pay")
      toast.success(t("wallet.depositCreated"))
      onChanged()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("wallet.topupError"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bottom-0 left-1/2 top-auto max-h-[92vh] w-full max-w-md translate-x-[-50%] translate-y-0 overflow-x-hidden overflow-y-auto rounded-b-none rounded-t-3xl p-0 data-open:slide-in-from-bottom-4"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          {step !== "amount" && step !== "done" && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setStep(step === "pay" ? "method" : "amount")}
              aria-label={t("wallet.back")}
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </Button>
          )}
          <DialogTitle className="flex-1 text-center font-bold">{t("wallet.addFunds")}</DialogTitle>
          <span className="w-8" />
        </div>

        <div className="px-4 pt-4 pb-safe">
          {step === "amount" && (
            <AmountStep
              t={t}
              isToman={isToman}
              input={input}
              setInput={setInput}
              chips={amountChips}
              tomanAmount={tomanAmount}
              onContinue={goMethod}
            />
          )}

          {step === "method" && (
            <MethodStep t={t} methods={methods} busy={busy} onPick={chooseMethod} active={method?.method} />
          )}

          {step === "pay" && instructions && (
            <PayStep
              t={t}
              instructions={instructions}
              holder={method?.holder ?? null}
              onSubmitted={() => setStep("done")}
              onChanged={onChanged}
            />
          )}

          {step === "done" && (
            <SubmittedStep t={t} amountToman={instructions?.amount ?? tomanAmount} onClose={() => onOpenChange(false)} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Step 1: amount ---------- */
function AmountStep({
  t,
  isToman,
  input,
  setInput,
  chips,
  tomanAmount,
  onContinue,
}: {
  t: ReturnType<typeof useI18n>["t"]
  isToman: boolean
  input: string
  setInput: (v: string) => void
  chips: number[]
  tomanAmount: number
  onContinue: () => void
}) {
  // Group the integer part into 3-digit blocks for readability (e.g. 5000000 -> 5,000,000).
  // The raw `input` stays free of separators so numeric parsing keeps working.
  const displayValue = useMemo(() => {
    if (!input) return ""
    const [intPart, decPart] = input.split(".")
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    return decPart !== undefined ? `${grouped}.${decPart}` : grouped
  }, [input])

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-muted-foreground">
        {isToman ? t("wallet.amountTomanLabel") : t("wallet.amountUsdLabel")}
      </label>
      <Input
        autoFocus
        inputMode="decimal"
        placeholder="0"
        value={displayValue}
        onChange={(e) => {
          let raw = e.target.value.replace(/[^0-9.]/g, "")
          // Toman amounts are whole numbers; only USD keeps a decimal part.
          if (isToman) raw = raw.replace(/\./g, "")
          else {
            const firstDot = raw.indexOf(".")
            if (firstDot !== -1) {
              raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "")
            }
          }
          setInput(raw)
        }}
        className="h-14 text-center text-2xl font-bold tabular-nums"
      />
      <div className="grid grid-cols-4 gap-2">
        {chips.map((c) => (
          <Button
            key={c}
            variant="outline"
            size="sm"
            onClick={() => setInput(String(c))}
            className="tabular-nums"
          >
            {isToman ? formatMoney(c) : `$${c}`}
          </Button>
        ))}
      </div>
      {!isToman && tomanAmount > 0 && (
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          ≈ {formatMoney(tomanAmount)} {t("common.toman")}
        </p>
      )}
      <Button onClick={onContinue} className="h-12 w-full text-base font-bold">
        {t("wallet.continue")}
      </Button>
    </div>
  )
}

/* ---------- Step 2: method ---------- */
function MethodStep({
  t,
  methods,
  busy,
  onPick,
  active,
}: {
  t: ReturnType<typeof useI18n>["t"]
  methods: MethodConfig[]
  busy: boolean
  onPick: (m: MethodConfig) => void
  active?: string
}) {
  const labels: Record<string, { title: string; sub: string }> = {
    CARD: { title: t("wallet.methodCard"), sub: t("wallet.methodCardSub") },
    USDT: { title: t("wallet.methodUsdt"), sub: t("wallet.network") + ": BEP20 / TRC20" },
    TON: { title: t("wallet.methodTon"), sub: t("wallet.network") + ": TON" },
    STARS: { title: t("wallet.methodStars"), sub: t("wallet.methodStarsSub") },
  }
  const visible = methods.filter((m) => m.enabled)
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">{t("wallet.chooseMethod")}</p>
      {visible.length === 0 && (
        <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
          {t("wallet.methodUnavailable")}
        </p>
      )}
      <div className="grid gap-2">
        {visible.map((m) => {
          const icon = METHOD_ICON[m.method]
          const l = labels[m.method]
          return (
            <button
              key={m.method}
              type="button"
              disabled={busy}
              onClick={() => onPick(m)}
              className="active:scale-press flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-start transition-colors hover:border-primary/40 disabled:opacity-60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                {icon?.lucide ? (
                  <CreditCard className="h-5 w-5 text-primary" />
                ) : (
                  <Image src={icon.src!} alt="" width={28} height={28} className="h-7 w-7" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-foreground">{l.title}</span>
                <span className="block text-xs text-muted-foreground">{l.sub}</span>
              </span>
              {busy && active === m.method ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-muted-foreground rtl:rotate-180" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Step 3: pay instructions ---------- */
function PayStep({
  t,
  instructions,
  holder,
  onSubmitted,
  onChanged,
}: {
  t: ReturnType<typeof useI18n>["t"]
  instructions: Instructions
  holder: string | null
  onSubmitted: () => void
  onChanged: () => void
}) {
  const isCard = instructions.method === "CARD"
  const isCrypto = instructions.method === "TON" || instructions.method === "USDT"
  const payDecimals = PAY_DECIMALS[instructions.payCurrency] ?? 2
  // Iranian banks operate in Rial, so card-to-card transfers show the amount in
  // Rial (Toman × 10). The wallet credit itself stays in Toman on the backend.
  const cardRialAmount = Number(instructions.payAmount) * 10

  const [left, setLeft] = useState(() =>
    instructions.expiresAt ? msUntil(instructions.expiresAt) : 0,
  )
  useEffect(() => {
    if (!instructions.expiresAt) return
    const id = setInterval(() => setLeft(msUntil(instructions.expiresAt!)), 1000)
    return () => clearInterval(id)
  }, [instructions.expiresAt])
  const expired = !!instructions.expiresAt && left <= 0

  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
      toast.success(t("wallet.copied"))
    })
  }

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file, "receipts")
      setReceiptUrl(url)
      await apiPatch(`/api/v1/wallet/deposits/${instructions.id}`, { receiptUrl: url })
      toast.success(t("wallet.receiptUploaded"))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("wallet.topupError"))
    } finally {
      setUploading(false)
    }
  }

  async function claimPaid() {
    setClaiming(true)
    try {
      await apiPatch(`/api/v1/wallet/deposits/${instructions.id}`, { paid: true })
      toast.success(t("wallet.pendingReview"))
      onChanged()
      onDone()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("wallet.topupError"))
    } finally {
      setClaiming(false)
    }
  }

  const payAmountStr = formatMoney(instructions.payAmount, payDecimals)

  return (
    <div className="space-y-4">
      {/* Amount to send — Rial for card (Iranian banks), pay currency otherwise */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
        <p className="text-xs text-muted-foreground">{t("wallet.sendExactly")}</p>
        <button
          type="button"
          onClick={() => copy(String(isCard ? cardRialAmount : instructions.payAmount), "amount")}
          className="mt-1 flex w-full items-center justify-center gap-2 text-2xl font-extrabold tabular-nums text-foreground"
        >
          {isCard ? formatMoney(cardRialAmount, 0) : payAmountStr}{" "}
          <span className="text-base font-bold text-primary">
            {isCard ? t("common.rial") : instructions.payCurrency}
          </span>
          {copied === "amount" ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Destination */}
      {instructions.payAddress && (
        <CopyRow
          label={isCard ? t("wallet.toCard") : t("wallet.toAddress")}
          value={instructions.payAddress}
          mono
          copied={copied === "addr"}
          onCopy={() => copy(instructions.payAddress!, "addr")}
        />
      )}
      {isCard && holder && <InfoRow label={t("wallet.cardHolder")} value={holder} />}
      {instructions.payNetwork && isCrypto && (
        <InfoRow label={t("wallet.network")} value={instructions.payNetwork} />
      )}
      {instructions.payTag && (
        <CopyRow
          label={t("wallet.transferNote")}
          value={instructions.payTag}
          mono
          copied={copied === "tag"}
          onCopy={() => copy(instructions.payTag!, "tag")}
        />
      )}

      {/* Countdown */}
      {instructions.expiresAt && (
        <div
          className={`flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-bold tabular-nums ${
            expired ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
          }`}
        >
          <Clock className="h-4 w-4" />
          {expired ? t("wallet.expired") : `${t("wallet.expiresIn")}: ${formatCountdown(left)}`}
        </div>
      )}

      {isCrypto && (
        <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {t("wallet.cryptoWarning")}
        </p>
      )}

      {/* Receipt upload */}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : receiptUrl ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading
          ? t("wallet.uploading")
          : receiptUrl
            ? t("wallet.receiptUploaded")
            : t("wallet.uploadReceipt")}
      </Button>

      <Button onClick={claimPaid} disabled={claiming} className="h-12 w-full text-base font-bold">
        {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : t("wallet.iPaid")}
      </Button>
    </div>
  )
}

function CopyRow({
  label,
  value,
  mono,
  copied,
  onCopy,
}: {
  label: string
  value: string
  mono?: boolean
  copied: boolean
  onCopy: () => void
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-card p-3 text-start"
    >
      <span className="block min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span
          className={`block break-all text-sm font-bold leading-snug ${mono ? "font-mono" : ""}`}
        >
          {value}
        </span>
      </span>
      {copied ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <Copy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  )
}
