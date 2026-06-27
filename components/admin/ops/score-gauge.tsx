"use client"

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"

/** Radial 0-100 performance score gauge with severity-based color. */
export function ScoreGauge({ score, loading }: { score: number; loading?: boolean }) {
  if (loading) return <Skeleton className="mx-auto size-40 rounded-full" />

  const color =
    score >= 80 ? "var(--chart-2)" : score >= 50 ? "var(--chart-1)" : "var(--destructive)"
  const data = [{ name: "score", value: score, fill: color }]

  return (
    <div className="relative mx-auto aspect-square w-40">
      <ChartContainer config={{ score: { label: "امتیاز" } }} className="size-full">
        <RadialBarChart
          data={data}
          startAngle={90}
          endAngle={-270}
          innerRadius="72%"
          outerRadius="100%"
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" background cornerRadius={12} isAnimationActive />
        </RadialBarChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold tabular-nums" style={{ color }}>
          {Math.round(score)}
        </span>
        <span className="text-[11px] text-muted-foreground">از ۱۰۰</span>
      </div>
    </div>
  )
}
