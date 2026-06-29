"use client"

import { useRef, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Undo2, Loader2, Upload, ShieldCheck, Info, CheckCircle2 } from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { SignInRequired } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { uploadFile } from "@/lib/upload-client"
import { formatToman, formatDateTime } from "@/lib/format"
import { REFUND_STATUS_TONE } from "@/lib/support-meta"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

type RefundStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID"

const REFUND_STATUS_KEY: Record<RefundStatus, MessageKey> = {
  PENDING: "refundStatus.PENDING",
  APPROVED: "refundStatus.APPROVED",
  REJECTED: "refundStatus.REJECTED",
  PAID: "refundStatus.PAID",
}

type Refund = {
  id: string
  publicId: string
  amount: number
  status: RefundStatus
  fullName: string
  cardLast4: string
  reason: string | null
  rejectReason: string | null
  createdAt: string
}

function groupDigits(value: string, size: number) {
  return value.replace(/\D/g, "").replace(new RegExp(`(\\d{${size}})(?=\\d)`, "g"), "$1 ").trim()
}

export default function RefundsPage() {
  const { user, refresh } = useSession()
  const { t } = useI18n()
  const { data, isLoading, mutate } = useSWR<{ data: Refund[] }>(
    user ? "/api/v1/refunds" : null,
    fetcher,
  )

  const [amount, setAmount] = useState("")
  const [fullName, setFullName] = useState("")
  const [nationalId, setNationalId] = useState("")
  const [cardNumber, setCardNumber] = useState("")
  const [iban, setIban] = useState("")
  const [reason, setReason] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const available = user?.balances?.availableBalance ?? 0
  const refunds = data?.data ?? []

  async function submit() {
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 10000) return toast.error(t("refunds.errMinAmount"))
    if (value > available) return toast.error(t("refunds.errOverBalance"))
    if (fullName.trim().length < 3) return toast.error(t("refunds.errFullName"))
    if (nationalId.replace(/\D/g, "").length !== 10) return toast.error(t("refunds.errNationalId"))
    if (cardNumber.replace(/\D/g, "").length !== 16) return toast.error(t("refunds.errCard"))
    if (!file) return toast.error(t("refunds.errFile"))

    setBusy(true)
    try {
      const nationalCardUrl = await uploadFile(file, "kyc")
      await apiPost("/api/v1/refunds", {
        amount: value,
        fullName,
        nationalId: nationalId.replace(/\D/g, ""),
        nationalCardUrl,
        cardNumber: cardNumber.replace(/\D/g, ""),
        iban: iban.replace(/\D/g, "") || undefined,
        reason: reason || undefined,
      })
      toast.success(t("refunds.success"))
      setAmount("")
      setFullName("")
      setNationalId("")
      setCardNumber("")
      setIban("")
      setReason("")
      setFile(null)
      await Promise.all([mutate(), refresh()])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("refunds.errSubmit"))
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return <SignInRequired description={t("refunds.signInRequired")} />
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Undo2 className="h-5 w-5 text-primary" />
          {t("refunds.title")}
        </h1>
        <p className="text-sm text-muted-foreground text-pretty">
          {t("refunds.subtitle")}
        </p>
      </header>

      <div className="flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-pretty">
          {t("refunds.notice")}
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("refunds.available")}</span>
          <span className="text-gold tabular-nums text-base font-extrabold">{formatToman(available)} {t("common.toman")}</span>
        </div>

        <Field label={t("refunds.amountLabel")}>
          <Input
            inputMode="numeric"
            placeholder={t("refunds.amountPlaceholder")}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            className="tabular-nums"
          />
        </Field>

        <Field label={t("refunds.fullNameLabel")}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("refunds.fullNamePlaceholder")} />
        </Field>

        <Field label={t("refunds.nationalIdLabel")}>
          <Input
            inputMode="numeric"
            maxLength={10}
            placeholder={t("refunds.nationalIdPlaceholder")}
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value.replace(/[^0-9]/g, ""))}
            className="tabular-nums"
          />
        </Field>

        <Field label={t("refunds.cardLabel")}>
          <Input
            inputMode="numeric"
            dir="ltr"
            placeholder="•••• •••• •••• ••••"
            value={groupDigits(cardNumber, 4)}
            onChange={(e) => setCardNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 16))}
            className="tabular-nums text-center"
          />
        </Field>

        <Field label="شماره شبا (اختیاری)">
          <Input
            inputMode="numeric"
            dir="ltr"
            placeholder="IR…"
            value={iban}
            onChange={(e) => setIban(e.target.value.replace(/[^0-9]/g, "").slice(0, 24))}
            className="tabular-nums"
          />
        </Field>

        <Field label="تصویر کارت ملی">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-background px-3 py-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {file ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Upload className="h-4 w-4" />}
            <span className="truncate">{file ? file.name : "انتخاب تصویر کارت ملی"}</span>
          </button>
        </Field>

        <Field label="توضیحات (اختیاری)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="در صورت تمایل علت درخواست را بنویسید" />
        </Field>

        <Button onClick={submit} disabled={busy} className="w-full gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "در حال ثبت…" : "ثبت درخواست بازگشت وجه"}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">درخواست‌های قبلی</h2>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : refunds.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            هنوز درخواستی ثبت نکرده‌اید.
          </div>
        ) : (
          <ul className="space-y-2">
            {refunds.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular-nums text-base font-extrabold">{formatToman(r.amount)} ت</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${REFUND_STATUS_TONE[r.status]}`}>
                    {REFUND_STATUS_LABELS[r.status]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span dir="ltr">کارت •••• {r.cardLast4}</span>
                  <span>{formatDateTime(r.createdAt)}</span>
                </div>
                {r.rejectReason && (
                  <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    دلیل رد: {r.rejectReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
