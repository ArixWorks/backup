"use client"

import useSWR from "swr"
import { BarChart3, Coins, Hash, Activity } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface UsageSummary {
  totalCalls: number
  okCalls: number
  errorCalls: number
  totalTokens: number
  totalCostUsd: number
  today: { tokens: number; costUsd: number }
  byFeature: { feature: string; calls: number; tokens: number; costUsd: number }[]
  byModel: { model: string; calls: number; tokens: number; costUsd: number }[]
  recent: {
    id: string
    feature: string
    model: string
    provider: string
    ok: boolean
    totalTokens: number | null
    costUsd: number
    latencyMs: number | null
    errorMessage: string | null
    createdAt: string
  }[]
}

const nf = new Intl.NumberFormat("fa-IR")
const usd = (v: number) => `$${v.toFixed(v < 1 ? 4 : 2)}`

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Coins
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function AiUsagePanel() {
  const { data, isLoading } = useSWR<{ data: UsageSummary }>(
    "/api/v1/admin/ai/usage?days=30",
    fetcher,
    { refreshInterval: 30000 },
  )
  const s = data?.data

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pt-1">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-extrabold">مصرف و هزینه</h2>
        <span className="text-xs text-muted-foreground">۳۰ روز اخیر</span>
      </div>

      {isLoading || !s ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              icon={Activity}
              label="کل درخواست‌ها"
              value={nf.format(s.totalCalls)}
              sub={`${nf.format(s.okCalls)} موفق • ${nf.format(s.errorCalls)} خطا`}
            />
            <Stat icon={Hash} label="کل توکن" value={nf.format(s.totalTokens)} />
            <Stat icon={Coins} label="هزینه تخمینی" value={usd(s.totalCostUsd)} />
            <Stat
              icon={Coins}
              label="امروز"
              value={usd(s.today.costUsd)}
              sub={`${nf.format(s.today.tokens)} توکن`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Breakdown
              title="بر اساس قابلیت"
              rows={s.byFeature.map((r) => ({ key: r.feature, calls: r.calls, costUsd: r.costUsd }))}
            />
            <Breakdown
              title="بر اساس مدل"
              rows={s.byModel.map((r) => ({ key: r.model, calls: r.calls, costUsd: r.costUsd }))}
              mono
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 text-sm font-bold">آخرین درخواست‌ها</div>
            {s.recent.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">هنوز درخواستی ثبت نشده است.</p>
            ) : (
              <div className="space-y-1.5">
                {s.recent.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge
                          variant={r.ok ? "secondary" : "destructive"}
                          className="shrink-0 text-[10px]"
                        >
                          {r.ok ? "OK" : "خطا"}
                        </Badge>
                        <span className="font-bold">{r.feature}</span>
                        <span className="truncate font-mono text-muted-foreground" dir="ltr">
                          {r.model}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-muted-foreground tabular-nums">
                        {r.totalTokens != null && <span>{nf.format(r.totalTokens)} tok</span>}
                        <span>{usd(r.costUsd)}</span>
                        {r.latencyMs != null && <span>{r.latencyMs}ms</span>}
                      </div>
                    </div>
                    {!r.ok && r.errorMessage && (
                      <p className="break-words rounded-md bg-destructive/10 px-2 py-1.5 text-[11px] leading-relaxed text-destructive" dir="auto">
                        علت: {r.errorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Breakdown({
  title,
  rows,
  mono,
}: {
  title: string
  rows: { key: string; calls: number; costUsd: number }[]
  mono?: boolean
}) {
  const max = Math.max(1, ...rows.map((r) => r.costUsd))
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 text-sm font-bold">{title}</div>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">داده‌ای موجود نیست.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.slice(0, 8).map((r) => (
            <div key={r.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className={mono ? "truncate font-mono" : "truncate font-medium"} dir={mono ? "ltr" : "rtl"}>
                  {r.key}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {nf.format(r.calls)} • {usd(r.costUsd)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(4, (r.costUsd / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
