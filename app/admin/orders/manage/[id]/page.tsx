"use client"

import { use, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  TimerReset,
  XCircle,
} from "lucide-react"
import { apiPost, ApiError, fetcher } from "@/lib/api-client"
import { formatNumber, formatToman } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusChip } from "@/components/orders/status-chip"
import { RoadmapStepper } from "@/components/orders/roadmap-stepper"
import { CountdownTimer } from "@/components/orders/countdown-timer"
import { CANCEL_REASON_CODES, type AdminOrderDetail } from "@/lib/orders/shared"
import { cn } from "@/lib/utils"

type TutorialOption = { id: string; title: string; slug: string }
type Response = { data: AdminOrderDetail }

const CANCEL_REASON_LABELS: Record<string, string> = {
  BUYING_ELSEWHERE: "خرید از جای دیگر",
  IN_A_HURRY: "عجله کاربر",
  CHANGED_MIND: "انصراف کاربر",
  TOO_LONG: "زمان زیاد تکمیل",
  OTHER: "سایر",
}

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, mutate } = useSWR<Response>(`/api/v1/admin/orders/lifecycle/${id}`, fetcher)
  const order = data?.data

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/orders/manage"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به مدیریت سفارش‌ها
      </Link>

      {isLoading || !order ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold">{order.title}</h1>
                <StatusChip status={order.status} />
                {order.overdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                    <Clock className="h-3 w-3" />
                    گذشته از موعد
                  </span>
                )}
              </div>
              <div className="text-end">
                <p className="font-bold">{formatToman(String(order.amount))} تومان</p>
                <p className="text-xs text-muted-foreground">تعداد {formatNumber(order.quantity)}</p>
              </div>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="شناسه سفارش" value={order.publicId} />
              <Row
                label="خریدار"
                value={order.user.displayName || order.user.alias || order.user.email || order.user.id}
              />
              {order.variantName && <Row label="پلن" value={order.variantName} />}
              {order.extensionCount > 0 && <Row label="دفعات تمدید" value={formatNumber(order.extensionCount)} />}
            </dl>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-5">
              <Card className="p-5">
                <h2 className="mb-4 font-bold">نقشه راه سفارش</h2>
                <RoadmapStepper steps={order.roadmap} />
              </Card>

              {order.customerInputValues && Object.keys(order.customerInputValues).length > 0 && (
                <CustomerInputReveal order={order} />
              )}

              {order.events.length > 0 && (
                <Card className="p-5">
                  <h2 className="mb-4 font-bold">تاریخچه رویدادها</h2>
                  <ol className="flex flex-col gap-3">
                    {order.events.map((e, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                        <div>
                          <p className="text-pretty">{e.message || e.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.actorType} · {new Date(e.createdAt).toLocaleString("fa-IR")}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
            </div>

            <div className="flex flex-col gap-5">
              {order.status === "PROCESSING" && order.dueAt && (
                <Card className="flex flex-col items-center p-5">
                  <CountdownTimer
                    dueAt={order.dueAt}
                    totalSeconds={(order.estimatedMinutes ?? 0) * 60}
                    labels={{ remaining: "زمان باقی‌مانده تا موعد", overdue: "گذشته از موعد" }}
                  />
                </Card>
              )}
              <AdminActions order={order} onDone={mutate} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" dir="auto">
        {value}
      </dd>
    </div>
  )
}

function CustomerInputReveal({ order }: { order: AdminOrderDetail }) {
  const [revealed, setRevealed] = useState(false)
  const template = order.customerInputTemplate ?? []
  const values = order.customerInputValues ?? {}

  function labelFor(key: string): string {
    const f = template.find((t) => t.key === key)
    return f?.label?.fa || key
  }
  function isSensitive(key: string): boolean {
    return template.find((t) => t.key === key)?.sensitive ?? false
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("کپی شد")
    } catch {
      toast.error("کپی ناموفق بود")
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold">اطلاعات ارسالی کاربر</h2>
        <Button variant="outline" size="sm" onClick={() => setRevealed((v) => !v)} className="gap-1.5">
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {revealed ? "پنهان کردن" : "نمایش"}
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {Object.entries(values).map(([key, val]) => {
          const hide = isSensitive(key) && !revealed
          return (
            <li
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            >
              <span className="shrink-0 text-muted-foreground">{labelFor(key)}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-mono" dir="ltr">
                  {hide ? "••••••••" : val}
                </span>
                <button
                  type="button"
                  onClick={() => copy(val)}
                  aria-label="کپی"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function AdminActions({ order, onDone }: { order: AdminOrderDetail; onDone: () => void }) {
  const canAct = order.status === "PROCESSING" || order.status === "AWAITING_EXTENSION_APPROVAL"
  const canCancel = !["DELIVERED", "REFUNDED", "CANCELLED", "FAILED"].includes(order.status)
  const { data: tutorials } = useSWR<{ data: TutorialOption[] }>(
    canAct ? "/api/v1/admin/tutorials/options" : null,
    fetcher,
  )

  const [note, setNote] = useState("")
  const [tutorialId, setTutorialId] = useState("")
  const [minutes, setMinutes] = useState("")
  const [reasonCode, setReasonCode] = useState<string>("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState<null | "complete" | "extend" | "cancel">(null)

  async function run(
    action: "complete" | "extend" | "cancel",
    body: Record<string, unknown>,
    confirmMsg?: string,
  ) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setBusy(action)
    try {
      await apiPost(`/api/v1/admin/orders/lifecycle/${order.id}/action`, { action, ...body })
      toast.success("انجام شد")
      onDone()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "عملیات ناموفق بود")
    } finally {
      setBusy(null)
    }
  }

  if (!canAct && !canCancel) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        این سفارش در وضعیت نهایی است و اقدام دیگری لازم نیست.
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      {canAct && (
        <>
          <div className="flex flex-col gap-2">
            <Label className="flex items-center gap-1.5 font-bold text-success">
              <CheckCircle2 className="h-4 w-4" />
              تکمیل سفارش
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="یادداشت تحویل (اختیاری) — برای کاربر نمایش داده می‌شود"
              rows={2}
            />
            <select
              value={tutorialId}
              onChange={(e) => setTutorialId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">بدون آموزش اختصاصی</option>
              {(tutorials?.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <Button
              onClick={() =>
                run("complete", { note: note.trim() || undefined, tutorialId: tutorialId || null })
              }
              disabled={busy !== null}
              className="gap-2 bg-success text-success-foreground hover:bg-success/90"
            >
              {busy === "complete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              تکمیل و تحویل
            </Button>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-5">
            <Label className="flex items-center gap-1.5 font-bold">
              <TimerReset className="h-4 w-4" />
              درخواست زمان بیشتر
            </Label>
            <div className="flex gap-2">
              <Input
                value={minutes}
                onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                dir="ltr"
                placeholder="دقیقه"
                className="font-mono"
              />
              <Button
                variant="outline"
                onClick={() => {
                  const m = Number(minutes)
                  if (!m || m < 1) return toast.error("مدت زمان را وارد کنید")
                  run("extend", { minutes: m })
                }}
                disabled={busy !== null}
                className="shrink-0 gap-2"
              >
                {busy === "extend" ? <Loader2 className="h-4 w-4 animate-spin" /> : <TimerReset className="h-4 w-4" />}
                درخواست تمدید
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              کاربر باید تمدید را تایید کند؛ در صورت رد، سفارش لغو و مبلغ بازگشت می‌شود.
            </p>
          </div>
        </>
      )}

      {canCancel && (
        <div className="flex flex-col gap-2 border-t border-border pt-5">
          <Label className="flex items-center gap-1.5 font-bold text-destructive">
            <XCircle className="h-4 w-4" />
            لغو سفارش و بازگشت وجه
          </Label>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">دلیل لغو (اختیاری)</option>
            {CANCEL_REASON_CODES.map((c) => (
              <option key={c} value={c}>
                {CANCEL_REASON_LABELS[c]}
              </option>
            ))}
          </select>
          {reasonCode === "OTHER" && (
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="توضیح دلیل لغو" />
          )}
          <Button
            variant="destructive"
            onClick={() =>
              run(
                "cancel",
                { reasonCode: reasonCode || undefined, reason: reason.trim() || undefined },
                `لغو سفارش و بازگشت ${formatToman(String(order.amount))} تومان به کیف پول کاربر؟ این عملیات قابل بازگشت نیست.`,
              )
            }
            disabled={busy !== null}
            className="gap-2"
          >
            {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            لغو و بازگشت وجه
          </Button>
        </div>
      )}
    </Card>
  )
}
