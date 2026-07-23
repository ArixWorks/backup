"use client"

import { use, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ChevronRight,
  Gift,
  Users,
  CheckCircle2,
  XCircle,
  Trophy,
  Dices,
  Clock,
  Pause,
  Play,
  Ban,
  Pencil,
  Loader2,
  Trash2,
  AlertTriangle,
  Download,
  Send,
  Package,
  RadioTower,
  Plus,
  Minus,
} from "lucide-react"
import { fetcher, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { formatNumber } from "@/lib/format"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EnhancedTextarea } from "@/components/rich-content"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { DeliveryField } from "@/lib/core/delivery-fields"
import { WinnerTotpDialog } from "@/components/admin/giveaways/winner-totp-dialog"

type Winner = {
  id: string
  position: number
  userId: string
  name: string | null
  username: string | null
  delivered: boolean
  deliveryError: string | null
  claimData: unknown
  has2fa: boolean
  totpMaxUses: number | null
}

type Detail = {
  giveaway: {
    id: string
    slug: string
    title: string
    prizeLabel: string
    prizeKind: string
    status: string
    winnersCount: number
    visibility: string
    autoDraw: boolean
    startAt: string
    endAt: string
    drawAt: string
    requiredChannels: { id: string; title: string; url: string }[] | null
  }
  stats: { total: number; eligible: number; ineligible: number; winners: number }
  channelPublication: { status: "NOT_SENT" | "SENT" | "FAILED"; sentAt?: string; error?: string }
  winners: Winner[]
  deliveryTemplate: DeliveryField[]
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "پیش‌نویس", className: "bg-secondary text-muted-foreground" },
  SCHEDULED: { label: "زمان‌بندی‌شده", className: "bg-primary/10 text-primary" },
  ACTIVE: { label: "فعال", className: "bg-success/15 text-success" },
  PAUSED: { label: "متوقف", className: "bg-warning/15 text-warning" },
  LOCKED: { label: "آماده قرعه‌کشی", className: "bg-warning/15 text-warning" },
  DRAWING: { label: "در حال قرعه‌کشی", className: "bg-primary/15 text-primary" },
  FINISHED: { label: "پایان‌یافته", className: "bg-secondary text-muted-foreground" },
  CANCELLED: { label: "لغو شده", className: "bg-destructive/10 text-destructive" },
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function GiveawayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, mutate } = useSWR<{ data: Detail }>(
    `/api/v1/admin/giveaways/${id}`,
    fetcher,
    { refreshInterval: 8000 },
  )
  const [busy, setBusy] = useState<string | null>(null)
  // Custom time-adjust controls: amount in minutes + which window it applies to.
  const [adjustMinutes, setAdjustMinutes] = useState("10")
  const [adjustTarget, setAdjustTarget] = useState<"registration" | "draw">("registration")
  const [deliveryWinner, setDeliveryWinner] = useState<Winner | null>(null)
  const [deliveryForm, setDeliveryForm] = useState<Record<string, string>>({})
  const [deliverySaving, setDeliverySaving] = useState(false)

  const detail = data?.data
  const g = detail?.giveaway
  const stats = detail?.stats
  const status = g?.status ?? ""
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT

  async function lifecycle(
    action: "publish" | "pause" | "resume" | "cancel" | "delay" | "adjust",
    minutes?: number,
    target?: "registration" | "draw",
  ) {
    setBusy(action)
    try {
      await apiPost(`/api/v1/admin/giveaways/${id}/lifecycle`, {
        action,
        ...(minutes !== undefined ? { minutes } : {}),
        ...(target ? { target } : {}),
      })
      toast.success("انجام شد")
      await mutate()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "خطا")
    } finally {
      setBusy(null)
    }
  }

  async function publishToChannel() {
    if (!confirm("پیام این قرعه‌کشی در کانال اصلی ارسال شود؟")) return
    setBusy("channel")
    try {
      await apiPost(`/api/v1/admin/giveaways/${id}/channel`, {})
      toast.success("پیام قرعه‌کشی با موفقیت در کانال ارسال شد")
      await mutate()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ارسال پیام به کانال ناموفق بود")
      await mutate()
    } finally {
      setBusy(null)
    }
  }

  async function draw() {
    if (!confirm("قرعه‌کشی انجام شود؟ این عمل قابل بازگشت نیست.")) return
    setBusy("draw")
    try {
      await apiPost(`/api/v1/admin/giveaways/${id}/draw`, {})
      toast.success("قرعه‌کشی انجام شد!")
      await mutate()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "خطا در قرعه‌کشی")
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!confirm("حذف کامل این قرعه‌کشی؟")) return
    try {
      await apiDelete(`/api/v1/admin/giveaways/${id}`)
      toast.success("حذف شد")
      window.location.href = "/admin/giveaways"
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "خطا")
    }
  }

  function openDelivery(winner: Winner) {
    setDeliveryForm({})
    setDeliveryWinner(winner)
  }

  async function deliverPrize() {
    if (!deliveryWinner) return
    const fields = Object.fromEntries(
      Object.entries(deliveryForm).filter(([, v]) => v.trim() !== ""),
    )
    const missing = (detail?.deliveryTemplate ?? []).filter(
      (f) => f.required && f.type !== "totp" && !fields[f.key],
    )
    if (missing.length > 0) {
      toast.error(`فیلدهای الزامی: ${missing.map((f) => f.label.fa).join("، ")}`)
      return
    }
    if (Object.keys(fields).length === 0) {
      toast.error("حداقل یک فیلد تحویل را پر کنید")
      return
    }
    setDeliverySaving(true)
    try {
      await apiPost(
        `/api/v1/admin/giveaways/${id}/winners/${deliveryWinner.id}/deliver`,
        { fields },
      )
      toast.success("اطلاعات جایزه با موفقیت برای برنده ثبت شد")
      setDeliveryWinner(null)
      await mutate()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "خطا در ثبت تحویل جایزه")
    } finally {
      setDeliverySaving(false)
    }
  }

  if (isLoading || !g || !stats) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  const canDraw = ["ACTIVE", "PAUSED", "LOCKED"].includes(status)
  const isFinished = status === "FINISHED"

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/giveaways" className="hover:text-foreground">
          قرعه‌کشی‌ها
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span className="truncate text-foreground">{g.title}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-extrabold text-balance">{g.title}</h1>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", meta.className)}>
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isFinished && status !== "DRAWING" && (
            <Link
              href={`/admin/giveaways/${id}/edit`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <Pencil className="h-3.5 w-3.5" />
              ویرایش
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={remove} className="gap-1.5 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
            حذف
          </Button>
        </div>
      </div>

      {/* Prize + timing summary */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-primary" />
          <strong>{g.prizeLabel}</strong>
          <span className="text-muted-foreground">({g.winnersCount} برنده)</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-4 w-4" />
          قرعه‌کشی: {fmtDate(g.drawAt)}
        </span>
        <Link href={`/giveaways/${g.slug}`} className="text-primary hover:underline" target="_blank">
          مشاهده صفحه عمومی
        </Link>
      </Card>

      <Card className="flex flex-col gap-4 border-primary/30 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 font-bold">
            <RadioTower className="h-5 w-5 text-primary" />
            انتشار در کانال اصلی
          </h2>
          {detail.channelPublication.status === "SENT" ? (
            <p className="text-sm text-success">پیام در {fmtDate(detail.channelPublication.sentAt!)} با دکمه شرکت در قرعه‌کشی ارسال شده است.</p>
          ) : detail.channelPublication.status === "FAILED" ? (
            <div className="space-y-1">
              <p className="text-sm text-destructive">ارسال قبلی ناموفق بود؛ می‌توانید دوباره تلاش کنید.</p>
              {detail.channelPublication.error && <p className="max-w-xl text-xs text-muted-foreground">{detail.channelPublication.error}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">پس از انتشار قرعه‌کشی، پیام آن را همراه دکمه ورود مستقیم به Mini App ارسال کنید.</p>
          )}
        </div>
        <Button
          onClick={publishToChannel}
          disabled={busy !== null || detail.channelPublication.status === "SENT" || ["DRAFT", "CANCELLED", "FINISHED"].includes(status)}
          className="gap-2 sm:min-w-44"
        >
          {busy === "channel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {detail.channelPublication.status === "FAILED" ? "تلاش مجدد" : detail.channelPublication.status === "SENT" ? "ارسال شده" : "ارسال به کانال"}
        </Button>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="کل شرکت‌کنندگان" value={stats.total} />
        <StatCard icon={CheckCircle2} label="واجد شرایط" value={stats.eligible} tone="success" />
        <StatCard icon={XCircle} label="غیرواجد" value={stats.ineligible} tone="destructive" />
        <StatCard icon={Trophy} label="برندگان" value={stats.winners} tone="primary" />
      </div>

      {/* CSV exports */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">خروجی اکسل:</span>
        <a
          href={`/api/v1/admin/giveaways/${id}/export?type=participants`}
          download
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5", stats.total === 0 && "pointer-events-none opacity-50")}
        >
          <Download className="h-3.5 w-3.5" />
          شرکت‌کنندگان ({stats.total})
        </a>
        <a
          href={`/api/v1/admin/giveaways/${id}/export?type=winners`}
          download
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5", stats.winners === 0 && "pointer-events-none opacity-50")}
        >
          <Download className="h-3.5 w-3.5" />
          برندگان ({stats.winners})
        </a>
      </div>

      {/* Draw control panel */}
      {!isFinished && status !== "CANCELLED" && (
        <Card className="space-y-4 border-primary/30 p-5">
          <h2 className="flex items-center gap-2 font-bold">
            <Dices className="h-5 w-5 text-primary" />
            کنترل قرعه‌کشی
          </h2>
          {stats.eligible === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="h-4 w-4" />
              هنوز شرکت‌کننده‌ی واجد شرایطی وجود ندارد.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={draw} disabled={busy !== null || stats.eligible === 0} className="gap-1.5">
              {busy === "draw" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />}
              شروع قرعه‌کشی
            </Button>
            <Button variant="outline" onClick={() => lifecycle("delay", 30)} disabled={busy !== null} className="gap-1.5">
              {busy === "delay" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              تعویق ۳۰ دقیقه
            </Button>
            {(status === "ACTIVE" || status === "LOCKED") && (
              <Button variant="outline" onClick={() => lifecycle("pause")} disabled={busy !== null} className="gap-1.5">
                {busy === "pause" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                توقف قرعه‌کشی
              </Button>
            )}
            {status === "PAUSED" && (
              <Button variant="outline" onClick={() => lifecycle("resume")} disabled={busy !== null} className="gap-1.5">
                {busy === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                ادامه قرعه‌کشی
              </Button>
            )}
            {(status === "DRAFT" || status === "SCHEDULED") && (
              <Button variant="outline" onClick={() => lifecycle("publish")} disabled={busy !== null} className="gap-1.5">
                {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                انتشار
              </Button>
            )}
            <Button variant="ghost" onClick={() => lifecycle("cancel")} disabled={busy !== null} className="gap-1.5 text-destructive">
              {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              لغو
            </Button>
          </div>

          {/* Custom time adjustment: extend or shorten the registration window or
              the draw time by any number of minutes. */}
          <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              تنظیم زمان قرعه‌کشی
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setAdjustTarget("registration")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors",
                    adjustTarget === "registration" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  مهلت ثبت‌نام
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustTarget("draw")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition-colors",
                    adjustTarget === "draw" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  زمان قرعه‌کشی
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  value={adjustMinutes}
                  onChange={(e) => setAdjustMinutes(e.target.value)}
                  className="h-8 w-20 text-center"
                  aria-label="دقیقه"
                />
                <span className="text-xs text-muted-foreground">دقیقه</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || !(Number(adjustMinutes) > 0)}
                onClick={() => lifecycle("adjust", Math.abs(Number(adjustMinutes)), adjustTarget)}
                className="h-8 gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                افزودن
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null || !(Number(adjustMinutes) > 0)}
                onClick={() => lifecycle("adjust", -Math.abs(Number(adjustMinutes)), adjustTarget)}
                className="h-8 gap-1"
              >
                <Minus className="h-3.5 w-3.5" />
                کاهش
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[5, 10, 30].map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => lifecycle("adjust", m, adjustTarget)}
                  className="h-7 px-2 text-xs"
                >
                  {`+${formatNumber(m)}`}
                </Button>
              ))}
              {[5, 10].map((m) => (
                <Button
                  key={`minus-${m}`}
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => lifecycle("adjust", -m, adjustTarget)}
                  className="h-7 px-2 text-xs text-destructive"
                >
                  {`−${formatNumber(m)}`}
                </Button>
              ))}
            </div>
          </div>
          {!canDraw && status !== "DRAFT" && status !== "SCHEDULED" && (
            <p className="text-xs text-muted-foreground">
              قرعه‌کشی فقط در وضعیت فعال، متوقف یا آماده قابل اجراست.
            </p>
          )}
        </Card>
      )}

      {/* Winners */}
      {detail.winners.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <Trophy className="h-5 w-5 text-primary" />
            برندگان
          </h2>
          <ul className="divide-y divide-border">
            {detail.winners.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {w.position}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{w.name || "کاربر"}</p>
                    {w.username && <p className="text-xs text-muted-foreground" dir="ltr">@{w.username}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-left">
                  {w.has2fa && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      2FA
                    </span>
                  )}
                  <WinnerTotpDialog
                    giveawayId={detail.giveaway.id}
                    winnerId={w.id}
                    hasTotp={w.has2fa}
                    maxUses={w.totpMaxUses}
                    onChange={() => mutate()}
                  />
                  {w.delivered ? (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      تحویل شد
                    </span>
                  ) : w.deliveryError ? (
                    <span className="flex items-center gap-1 text-xs text-destructive" title={w.deliveryError}>
                      <XCircle className="h-3.5 w-3.5" />
                      خطای تحویل
                    </span>
                  ) : (
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                      <span className="text-xs text-warning">در انتظار تحویل دستی</span>
                      <Button size="sm" onClick={() => openDelivery(w)} className="h-8 gap-1.5">
                        <Send className="h-3.5 w-3.5" />
                        ثبت تحویل جایزه
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={!!deliveryWinner} onOpenChange={(open) => !open && setDeliveryWinner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              ثبت اطلاعات جایزه
            </DialogTitle>
            <DialogDescription>
              اطلاعات خصوصی جایزه {g.prizeLabel} برای {deliveryWinner?.name || "برنده"} ثبت می‌شود و فقط همان کاربر آن را در «جوایز من» می‌بیند.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {(detail.deliveryTemplate ?? [])
              .filter((f) => f.type !== "totp")
              .map((f) =>
                f.type === "note" ? (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={`winner-${f.key}`}>
                      {f.label.fa}
                      {f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    <EnhancedTextarea
                      id={`winner-${f.key}`}
                      value={deliveryForm[f.key] ?? ""}
                      onChange={(value) => setDeliveryForm((s) => ({ ...s, [f.key]: value }))}
                      minRows={3}
                      maxRows={10}
                      showCount={false}
                    />
                  </div>
                ) : (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={`winner-${f.key}`}>
                      {f.label.fa}
                      {f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    <Input
                      id={`winner-${f.key}`}
                      dir="ltr"
                      autoComplete="off"
                      placeholder={f.placeholder}
                      value={deliveryForm[f.key] ?? ""}
                      onChange={(event) =>
                        setDeliveryForm((s) => ({ ...s, [f.key]: event.target.value }))
                      }
                    />
                  </div>
                ),
              )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryWinner(null)}>انصراف</Button>
            <Button onClick={deliverPrize} disabled={deliverySaving} className="gap-2">
              {deliverySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              تحویل جایزه به برنده
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Users
  label: string
  value: number
  tone?: "default" | "success" | "destructive" | "primary"
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "primary"
          ? "text-primary"
          : "text-foreground"
  return (
    <Card className="flex flex-col gap-1 p-4">
      <Icon className={cn("h-4 w-4", toneClass)} />
      <span className="text-2xl font-extrabold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Card>
  )
}
