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
} from "lucide-react"
import { fetcher, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Winner = {
  id: string
  position: number
  userId: string
  name: string | null
  username: string | null
  delivered: boolean
  deliveryError: string | null
  claimData: unknown
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
  winners: Winner[]
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

  const detail = data?.data
  const g = detail?.giveaway
  const stats = detail?.stats
  const status = g?.status ?? ""
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT

  async function lifecycle(action: "publish" | "pause" | "resume" | "cancel" | "delay", minutes?: number) {
    setBusy(action)
    try {
      await apiPost(`/api/v1/admin/giveaways/${id}/lifecycle`, { action, ...(minutes ? { minutes } : {}) })
      toast.success("انجام شد")
      await mutate()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "خطا")
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
            {status === "ACTIVE" && (
              <Button variant="outline" onClick={() => lifecycle("pause")} disabled={busy !== null} className="gap-1.5">
                {busy === "pause" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                توقف ثبت‌نام
              </Button>
            )}
            {status === "PAUSED" && (
              <Button variant="outline" onClick={() => lifecycle("resume")} disabled={busy !== null} className="gap-1.5">
                {busy === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                ادامه ثبت‌نام
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
                <div className="text-left">
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
                    <span className="text-xs text-warning">در انتظار تحویل دستی</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
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
