"use client"

import { useMemo } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMetricValue } from "@/lib/monitoring/format"

export type SeriesMap = Record<string, { t: string; value: number }[]>

export type ChartSeriesDef = {
  key: string
  label: string
  color: string // css var reference e.g. "var(--chart-1)"
  unit?: string
}

/**
 * Multi-series time chart (area | line | bar) wired to the shadcn ChartContainer
 * for consistent theming, tooltips and responsiveness. Merges multiple metric
 * series onto a shared time axis.
 */
export function MetricChart({
  series,
  defs,
  kind = "area",
  height = 240,
  loading,
  emptyLabel = "داده‌ای برای نمایش وجود ندارد",
}: {
  series: SeriesMap
  defs: ChartSeriesDef[]
  kind?: "area" | "line" | "bar"
  height?: number
  loading?: boolean
  emptyLabel?: string
}) {
  const { rows, config, isEmpty } = useMemo(() => {
    const byTime = new Map<string, Record<string, number | string>>()
    for (const def of defs) {
      const points = series[def.key] ?? []
      for (const p of points) {
        const label = new Date(p.t).toLocaleTimeString("fa-IR", {
          hour: "2-digit",
          minute: "2-digit",
        })
        const row = byTime.get(p.t) ?? { t: label }
        row[def.key] = p.value
        byTime.set(p.t, row)
      }
    }
    const rows = [...byTime.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)
    const config: ChartConfig = {}
    for (const def of defs) config[def.key] = { label: def.label, color: def.color }
    return { rows, config, isEmpty: rows.length === 0 }
  }, [series, defs])

  if (loading) return <Skeleton className="w-full rounded-xl" style={{ height }} />

  if (isEmpty) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-xl border border-dashed border-border/70 text-sm text-muted-foreground"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    )
  }

  const unit = defs[0]?.unit

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      {kind === "bar" ? (
        <BarChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} fontSize={11} reversed />
          <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={(v) => formatMetricValue(Number(v), unit)} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {defs.map((d) => (
            <Bar key={d.key} dataKey={d.key} fill={`var(--color-${d.key})`} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      ) : kind === "line" ? (
        <LineChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} fontSize={11} reversed />
          <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={(v) => formatMetricValue(Number(v), unit)} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {defs.map((d) => (
            <Line key={d.key} type="monotone" dataKey={d.key} stroke={`var(--color-${d.key})`} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      ) : (
        <AreaChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
          <defs>
            {defs.map((d) => (
              <linearGradient key={d.key} id={`fill-${d.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${d.key})`} stopOpacity={0.35} />
                <stop offset="95%" stopColor={`var(--color-${d.key})`} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} fontSize={11} reversed />
          <YAxis tickLine={false} axisLine={false} width={44} fontSize={11} tickFormatter={(v) => formatMetricValue(Number(v), unit)} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {defs.map((d) => (
            <Area key={d.key} type="monotone" dataKey={d.key} stroke={`var(--color-${d.key})`} strokeWidth={2} fill={`url(#fill-${d.key})`} isAnimationActive={false} stackId={undefined} />
          ))}
        </AreaChart>
      )}
    </ChartContainer>
  )
}
