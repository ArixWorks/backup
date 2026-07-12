"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Bug, Check, ChevronDown, Clock3, MapPin, RotateCcw, ShieldCheck, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { apiPost } from "@/lib/api-client"
import { useOpsData } from "../use-ops-data"

type Diagnosis = {
  id: string
  status: string
  model?: string | null
  area: string
  likelyFile?: string | null
  likelyFunction?: string | null
  rootCause: string
  impact: string
  confidence: number
  evidence: string[]
  steps: string[]
  canAutoFix: boolean
  failureReason?: string | null
  approvedAt?: string | null
  createdAt: string
}
type ErrorEvent = {
  id: string
  level: string
  source: string
  name: string
  message: string
  stack?: string | null
  context?: Record<string, unknown> | null
  release?: string | null
  count: number
  resolved: boolean
  resolvedAt?: string | null
  firstSeenAt: string
  lastSeenAt: string
  diagnoses: Diagnosis[]
}
type ErrorsResp = {
  events: ErrorEvent[]
  bySource: { source: string; count: number }[]
  totalUnresolved: number
}

const SOURCE_LABELS: Record<string, string> = {
  WEB: "وب‌سایت", MINIAPP: "مینی‌اپ", BOT: "ربات", API: "API", SERVER_ACTION: "Server Action",
  WORKER: "ورکر", CRON: "Cron", QUEUE: "صف", WEBHOOK: "وبهوک",
}
const exactDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran", year: "numeric", month: "long", day: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
})
const relative = new Intl.RelativeTimeFormat("fa-IR", { numeric: "auto" })

function formatExact(value: string) {
  return exactDate.format(new Date(value))
}
function formatRelative(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  if (Math.abs(seconds) < 60) return relative.format(seconds, "second")
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, "hour")
  return relative.format(Math.round(hours / 24), "day")
}
function formatDuration(start: string, end: string) {
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
  if (minutes < 1) return "کمتر از یک دقیقه"
  if (minutes < 60) return `${minutes.toLocaleString("fa-IR")} دقیقه`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours.toLocaleString("fa-IR")} ساعت${rest ? ` و ${rest.toLocaleString("fa-IR")} دقیقه` : ""}`
}

export function ErrorsTab() {
  const [showResolved, setShowResolved] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const key = `/api/v1/admin/ops/errors?resolved=${showResolved ? "1" : "0"}&limit=100`
  const { data, isLoading, mutate } = useOpsData<ErrorsResp>(key, { on: ["error"], refreshInterval: 20000 })

  async function act(id: string, action: "resolve" | "unresolve") {
    setBusy(id)
    try {
      await apiPost("/api/v1/admin/ops/errors", { id, action })
      toast.success(action === "resolve" ? "خطا به‌عنوان حل‌شده علامت خورد" : "خطا بازگشایی شد")
      void mutate()
    } catch { toast.error("عملیات ناموفق بود") } finally { setBusy(null) }
  }
  async function diagnose(id: string) {
    setBusy(`ai:${id}`)
    try {
      const result = await apiPost<{ diagnosis: Diagnosis }>(`/api/v1/admin/ops/errors/${id}/diagnose`, {})
      toast[result.diagnosis.status === "COMPLETED" ? "success" : "error"](
        result.diagnosis.status === "COMPLETED" ? "تحلیل AI آماده شد" : "تحلیل AI تکمیل نشد؛ دوباره تلاش کنید",
      )
      await mutate()
      setExpanded(id)
    } catch { toast.error("سرویس تحلیل AI در دسترس نیست") } finally { setBusy(null) }
  }
  async function approve(id: string) {
    setBusy(`approve:${id}`)
    try {
      await apiPost(`/api/v1/admin/ops/errors/diagnoses/${id}/approve`, {})
      toast.success("راهکار توسط مالک تأیید شد؛ هیچ تغییری خودکار اجرا نشده است")
      void mutate()
    } catch { toast.error("تأیید راهکار ناموفق بود") } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(data?.bySource ?? []).slice(0, 4).map((s) => (
          <div key={s.source} className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
            <p className="text-xs text-muted-foreground">{SOURCE_LABELS[s.source] ?? s.source}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-destructive">{s.count}</p>
          </div>
        ))}
        {(!data || data.bySource.length === 0) && !isLoading ? <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">خطای حل‌نشده‌ای وجود ندارد.</div> : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold"><Bug className="size-4 text-primary" />{showResolved ? "خطاهای حل‌شده" : "خطاهای فعال"}</div>
        <Button variant="outline" size="sm" onClick={() => setShowResolved((v) => !v)}>{showResolved ? "نمایش فعال‌ها" : "نمایش حل‌شده‌ها"}</Button>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />) : (data?.events.length ?? 0) === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/70 text-sm text-muted-foreground">موردی برای نمایش وجود ندارد.</div>
        ) : data?.events.map((e) => {
          const diagnosis = e.diagnoses[0]
          const endAt = e.resolvedAt ?? e.lastSeenAt
          return (
            <article key={e.id} className={cn("rounded-2xl border bg-card/80 p-4 backdrop-blur-sm", e.resolved ? "border-border/60" : "border-destructive/35")}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{SOURCE_LABELS[e.source] ?? e.source}</Badge>
                    <Badge variant={e.level === "fatal" || e.level === "error" ? "destructive" : "secondary"} className="text-[10px]">{e.level}</Badge>
                    <span className="font-semibold">{e.name}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums">×{e.count.toLocaleString("fa-IR")}</span>
                    <Badge variant={e.resolved ? "secondary" : "outline"}>{e.resolved ? "تاریخی / رفع‌شده" : "فعال"}</Badge>
                  </div>
                  <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{e.message}</p>
                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <TimeItem label="اولین مشاهده" value={formatExact(e.firstSeenAt)} hint={formatRelative(e.firstSeenAt)} />
                    <TimeItem label="آخرین مشاهده" value={formatExact(e.lastSeenAt)} hint={formatRelative(e.lastSeenAt)} />
                    <TimeItem label={e.resolved ? "زمان رفع" : "مدت رخداد"} value={e.resolvedAt ? formatExact(e.resolvedAt) : formatDuration(e.firstSeenAt, e.lastSeenAt)} />
                    <TimeItem label="بازه ثبت‌شده" value={formatDuration(e.firstSeenAt, endAt)} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-52 lg:justify-end">
                  <Button size="sm" variant="outline" disabled={busy === `ai:${e.id}`} onClick={() => diagnose(e.id)}>
                    <Sparkles data-icon="inline-start" />{busy === `ai:${e.id}` ? "در حال تحلیل..." : diagnosis ? "تحلیل مجدد با AI" : "تحلیل با AI"}
                  </Button>
                  <Button size="sm" variant={e.resolved ? "outline" : "default"} disabled={busy === e.id} onClick={() => act(e.id, e.resolved ? "unresolve" : "resolve")}>
                    {e.resolved ? <RotateCcw data-icon="inline-start" /> : <Check data-icon="inline-start" />}{e.resolved ? "بازگشایی" : "حل شد"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExpanded((id) => id === e.id ? null : e.id)}>
                    جزئیات <ChevronDown className={cn("size-3 transition-transform", expanded === e.id && "rotate-180")} />
                  </Button>
                </div>
              </div>

              {diagnosis ? <DiagnosisPanel diagnosis={diagnosis} busy={busy} onApprove={approve} /> : null}
              {expanded === e.id && e.stack ? <pre dir="ltr" className="mt-4 max-h-64 overflow-auto rounded-xl bg-secondary/60 p-4 text-left text-[11px] leading-relaxed text-muted-foreground">{e.stack}</pre> : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function TimeItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-xl border border-border/60 bg-secondary/30 p-3"><div className="flex items-center gap-1 text-muted-foreground"><Clock3 className="size-3.5" />{label}</div><p className="mt-1 font-semibold text-foreground">{value}</p>{hint ? <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p> : null}</div>
}

function DiagnosisPanel({ diagnosis, busy, onApprove }: { diagnosis: Diagnosis; busy: string | null; onApprove: (id: string) => void }) {
  if (diagnosis.status === "RUNNING") return <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">AI در حال تحلیل خطا است...</div>
  if (diagnosis.status === "FAILED") return <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p className="font-bold text-destructive">تحلیل AI ناموفق بود</p><p className="mt-1 text-muted-foreground">{diagnosis.failureReason ?? "پیکربندی یا سهمیه سرویس AI را بررسی کنید."}</p></div>
  return (
    <section className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4" aria-label="تحلیل هوش مصنوعی">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /><h3 className="text-sm font-bold">تحلیل AI</h3><Badge variant="outline">اطمینان {Math.round(diagnosis.confidence * 100).toLocaleString("fa-IR")}٪</Badge></div>
        <span className="text-[10px] text-muted-foreground">{formatExact(diagnosis.createdAt)}{diagnosis.model ? ` · ${diagnosis.model}` : ""}</span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div><p className="flex items-center gap-1 text-xs font-bold"><MapPin className="size-3.5" />بخش درگیر</p><p className="mt-1 text-sm">{diagnosis.area}</p>{diagnosis.likelyFile ? <code dir="ltr" className="mt-2 block break-all rounded-lg bg-secondary/60 p-2 text-left text-xs">{diagnosis.likelyFile}{diagnosis.likelyFunction ? ` · ${diagnosis.likelyFunction}` : ""}</code> : null}</div>
        <div><p className="flex items-center gap-1 text-xs font-bold"><AlertTriangle className="size-3.5" />اثر خطا</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{diagnosis.impact}</p></div>
      </div>
      <div className="mt-4"><p className="text-xs font-bold">علت ریشه‌ای</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{diagnosis.rootCause}</p></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div><p className="text-xs font-bold">شواهد</p><ul className="mt-2 list-inside list-disc text-sm leading-7 text-muted-foreground">{diagnosis.evidence.map((item, i) => <li key={i}>{item}</li>)}</ul></div>
        <div><p className="text-xs font-bold">راهکار و مراحل بررسی</p><ol className="mt-2 list-inside list-decimal text-sm leading-7 text-muted-foreground">{diagnosis.steps.map((item, i) => <li key={i}>{item}</li>)}</ol></div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <p className="text-xs text-muted-foreground">این راهکار توسط AI پیشنهاد شده و هنوز هیچ کد، دیتابیس یا دیپلویی تغییر نکرده است.</p>
        {diagnosis.approvedAt ? <Badge variant="secondary"><ShieldCheck className="size-3" />تأیید مالک در {formatExact(diagnosis.approvedAt)}</Badge> : <Button size="sm" variant="outline" disabled={busy === `approve:${diagnosis.id}`} onClick={() => onApprove(diagnosis.id)}><ShieldCheck data-icon="inline-start" />تأیید راهکار توسط مالک</Button>}
      </div>
    </section>
  )
}
