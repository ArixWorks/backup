"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Play, Clock, CheckCircle2, XCircle, MinusCircle, Loader2 } from "lucide-react"
import { fetcher, apiPatch, apiPost, ApiError } from "@/lib/api-client"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

type LastRun = {
  status: string
  summary: string | null
  error: string | null
  createdAt: string
}

type Automation = {
  key: string
  title: string
  description: string
  enabled: boolean
  intervalMin: number
  config: Record<string, unknown>
  lastRunAt: string | null
  nextRunAt: string | null
  lastStatus: string | null
  lastRun: LastRun | null
}

type RecentRun = {
  id: string
  key: string
  status: string
  summary: string | null
  error: string | null
  durationMs: number
  createdAt: string
}

type ApiShape = { automations: Automation[]; recentRuns: RecentRun[] }

const API = "/api/v1/admin/ai/automations"

function fmtInterval(min: number): string {
  if (min % 1440 === 0) return `هر ${min / 1440} روز`
  if (min % 60 === 0) return `هر ${min / 60} ساعت`
  return `هر ${min} دقیقه`
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })
}

function StatusIcon({ status }: { status: string | null }) {
  if (status === "ok") return <CheckCircle2 className="size-4 text-emerald-500" />
  if (status === "error") return <XCircle className="size-4 text-destructive" />
  if (status === "skipped") return <MinusCircle className="size-4 text-muted-foreground" />
  return <Clock className="size-4 text-muted-foreground" />
}

export function AutomationsManager() {
  const { data, isLoading, mutate } = useSWR<ApiShape>(API, fetcher)
  const [busy, setBusy] = useState<string | null>(null)
  const [intervals, setIntervals] = useState<Record<string, string>>({})

  async function patch(key: string, body: Record<string, unknown>) {
    setBusy(key)
    try {
      await apiPatch(API, { key, ...body })
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "به‌روزرسانی ناموفق بود")
    } finally {
      setBusy(null)
    }
  }

  async function runNow(key: string) {
    setBusy(key)
    try {
      const res = await apiPost<{ data: { summary: string; status: string } }>(`${API}/${key}/run`)
      toast.success(res.data?.summary || "اجرا شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "اجرا ناموفق بود")
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const automations = data?.automations ?? []
  const recentRuns = data?.recentRuns ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {automations.map((a) => {
          const isBusy = busy === a.key
          const intervalValue = intervals[a.key] ?? String(a.intervalMin)
          return (
            <Card key={a.key} className="flex flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{a.title}</h3>
                    {a.lastStatus && (
                      <span className="inline-flex items-center gap-1">
                        <StatusIcon status={a.lastStatus} />
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground text-pretty">{a.description}</p>
                </div>
                <Switch
                  checked={a.enabled}
                  disabled={isBusy}
                  onCheckedChange={(v) => patch(a.key, { enabled: v })}
                  aria-label={`فعال‌سازی ${a.title}`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Badge variant={a.enabled ? "default" : "secondary"}>
                  {a.enabled ? "فعال" : "غیرفعال"}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {fmtInterval(a.intervalMin)}
                </span>
                <span>آخرین اجرا: {fmtDate(a.lastRunAt)}</span>
                {a.enabled && <span>اجرای بعدی: {fmtDate(a.nextRunAt)}</span>}
              </div>

              {a.lastRun?.summary && (
                <p className="rounded-lg bg-muted/50 p-2 text-xs text-foreground">
                  {a.lastRun.summary}
                </p>
              )}
              {a.lastRun?.error && (
                <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                  {a.lastRun.error}
                </p>
              )}

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground" htmlFor={`int-${a.key}`}>
                    فاصله (دقیقه)
                  </label>
                  <Input
                    id={`int-${a.key}`}
                    type="number"
                    min={15}
                    max={43200}
                    value={intervalValue}
                    onChange={(e) => setIntervals((p) => ({ ...p, [a.key]: e.target.value }))}
                    className="h-9 w-32"
                    dir="ltr"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isBusy || intervalValue === String(a.intervalMin)}
                  onClick={() => patch(a.key, { intervalMin: Number(intervalValue) })}
                >
                  ذخیره فاصله
                </Button>
                <Button
                  size="sm"
                  disabled={isBusy}
                  onClick={() => runNow(a.key)}
                  className="gap-1"
                >
                  {isBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  اجرای فوری
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">تاریخچه اجراها</h2>
        {recentRuns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            هنوز اجرایی ثبت نشده است.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start font-medium">اتوماسیون</th>
                  <th className="p-2 text-start font-medium">وضعیت</th>
                  <th className="p-2 text-start font-medium">خلاصه</th>
                  <th className="p-2 text-start font-medium">زمان</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2 font-mono text-xs text-foreground" dir="ltr">
                      {r.key}
                    </td>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1">
                        <StatusIcon status={r.status} />
                      </span>
                    </td>
                    <td className="p-2 text-muted-foreground">{r.summary || r.error || "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
