"use client"

import useSWR from "swr"
import { fetcher } from "@/lib/api-client"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber } from "@/lib/format"
import { TEMPLATE_LABELS } from "./labels"

type Stats = {
  total: number
  sent: number
  delivered: number
  failed: number
  bounced: number
  queued: number
  opens: number
  clicks: number
  deliveryRate: number // fraction 0..1
  openRate: number // fraction 0..1
  bounceRate: number // fraction 0..1
}
type Analytics = {
  days: number
  stats: Stats
  byTemplate: { template: string; count: number }[]
  daily: { date: string; count: number }[]
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" | "warn" }) {
  const toneClass =
    tone === "good"
      ? "text-success"
      : tone === "bad"
        ? "text-destructive"
        : tone === "warn"
          ? "text-warning"
          : "text-foreground"
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </Card>
  )
}

export function EmailAnalytics() {
  const { data, isLoading } = useSWR<{ data: Analytics }>("/api/v1/admin/email/analytics?days=14", fetcher, {
    refreshInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  const s = data?.data.stats
  if (!s) return null
  const maxDaily = Math.max(1, ...(data?.data.daily.map((d) => d.count) ?? [1]))
  const pct = (frac: number) => `${Math.round(frac * 100)}٪`

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="کل ایمیل‌ها (۱۴ روز)" value={formatNumber(s.total)} />
        <Kpi label="ارسال‌شده" value={formatNumber(s.sent + s.delivered)} />
        <Kpi label="نرخ تحویل" value={pct(s.deliveryRate)} tone={s.deliveryRate >= 0.95 ? "good" : "warn"} />
        <Kpi label="نرخ بازشدن" value={pct(s.openRate)} tone="good" />
        <Kpi label="در صف" value={formatNumber(s.queued)} tone={s.queued > 0 ? "warn" : undefined} />
        <Kpi label="ناموفق" value={formatNumber(s.failed)} tone={s.failed > 0 ? "bad" : "good"} />
        <Kpi label="برگشتی" value={formatNumber(s.bounced)} tone={s.bounced > 0 ? "bad" : "good"} />
        <Kpi label="کلیک‌شده" value={formatNumber(s.clicks)} />
      </div>

      {/* Daily volume */}
      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold">حجم روزانه</p>
        <div className="flex h-32 items-end gap-1">
          {data?.data.daily.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
              <div
                className="w-full rounded-t bg-primary/70 transition-all"
                style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
              />
              <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Per-template breakdown */}
      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold">بر اساس نوع</p>
        <div className="flex flex-col gap-2">
          {data?.data.byTemplate.length === 0 && (
            <p className="text-sm text-muted-foreground">داده‌ای ثبت نشده است.</p>
          )}
          {data?.data.byTemplate.map((t) => (
            <div key={t.template} className="flex items-center justify-between text-sm">
              <span>{TEMPLATE_LABELS[t.template] ?? t.template}</span>
              <span className="font-mono text-muted-foreground">{formatNumber(t.count)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
