"use client"

import type { ReactNode } from "react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type Trend = { value: number }[]

/**
 * Premium KPI card with optional inline sparkline and severity accent.
 * Used across every Operations Center tab for headline metrics.
 */
export function KpiCard({
  label,
  value,
  icon,
  hint,
  severity = "ok",
  spark,
  loading,
  className,
}: {
  label: string
  value?: ReactNode
  icon?: ReactNode
  hint?: ReactNode
  severity?: "ok" | "warn" | "critical"
  spark?: Trend
  loading?: boolean
  className?: string
}) {
  const accent =
    severity === "critical"
      ? "text-destructive"
      : severity === "warn"
        ? "text-chart-1"
        : "text-foreground"
  const sparkColor =
    severity === "critical"
      ? "var(--destructive)"
      : severity === "warn"
        ? "var(--chart-1)"
        : "var(--chart-2)"

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm transition-colors",
        "hover:border-border",
        severity === "critical" && "border-destructive/40",
        className,
      )}
    >
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        {icon ? <span className={cn("shrink-0", accent)}>{icon}</span> : null}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <div className={cn("mt-2 text-2xl font-extrabold tabular-nums", accent)}>{value ?? "—"}</div>
      )}

      {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}

      {spark && spark.length > 1 && !loading ? (
        <div className="mt-3 h-10 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={sparkColor}
                strokeWidth={1.5}
                fill={`url(#spark-${label})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  )
}
