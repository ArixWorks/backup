"use client"

import { Zap, AlertTriangle, Timer, Users, Database, Layers, Server } from "lucide-react"
import { KpiCard } from "../kpi-card"
import { MetricChart } from "../metric-chart"
import { useOpsData } from "../use-ops-data"
import { formatMetricValue } from "@/lib/monitoring/format"

type Kpi = { name: string; value: number | null; unit?: string; severity: "ok" | "warn" | "critical" }
type KpiResp = { kpis: Kpi[] }
type SeriesResp = { series: Record<string, { t: string; value: number }[]> }

const ICONS: Record<string, typeof Zap> = {
  "app.rps": Zap,
  "app.error_rate": AlertTriangle,
  "app.latency.p95": Timer,
  "app.active_users": Users,
  "db.latency": Database,
  "redis.latency": Layers,
}

const LABELS: Record<string, string> = {
  "app.rps": "درخواست/ثانیه",
  "app.error_rate": "نرخ خطا",
  "app.latency.p50": "تأخیر (میانه)",
  "app.latency.p95": "تأخیر p95",
  "app.active_sessions": "نشست‌های فعال",
  "app.active_users": "کاربران آنلاین",
  "app.queue.size": "اندازه صف",
  "app.queue.latency": "زمان پردازش صف",
  "app.ws.connections": "اتصالات WebSocket",
  "app.cron.duration": "زمان اجرای Cron",
  "app.cron.failures": "Cronهای ناموفق",
  "db.latency": "تأخیر PostgreSQL",
  "db.pool.used": "اتصالات DB",
  "db.slow_queries": "کوئری‌های کند",
  "redis.latency": "تأخیر Redis",
  "cache.hit_ratio": "نرخ Hit کش",
}

export function AppTab({ range }: { range: string }) {
  const { data: kpiData, isLoading } = useOpsData<KpiResp>(
    "/api/v1/admin/ops/metrics?category=app",
    { on: ["metrics"], refreshInterval: 15000 },
  )

  const { data: traffic, isLoading: tLoading } = useOpsData<SeriesResp>(
    `/api/v1/admin/ops/metrics?series=app.rps,app.error_rate&range=${range}`,
    { on: ["metrics"], refreshInterval: 20000 },
  )

  const { data: latency } = useOpsData<SeriesResp>(
    `/api/v1/admin/ops/metrics?series=app.latency.p50,app.latency.p95,db.latency&range=${range}`,
    { on: ["metrics"], refreshInterval: 20000 },
  )

  const kpis = kpiData?.kpis ?? []
  const featured = ["app.rps", "app.error_rate", "app.latency.p95", "app.active_users"]
  const featuredKpis = featured.map((n) => kpis.find((k) => k.name === n)).filter(Boolean) as Kpi[]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(isLoading ? featured.map((n) => ({ name: n, value: null, severity: "ok" as const })) : featuredKpis).map(
          (k) => {
            const Icon = ICONS[k.name] ?? Server
            return (
              <KpiCard
                key={k.name}
                label={LABELS[k.name] ?? k.name}
                value={formatMetricValue(k.value, k.unit)}
                icon={<Icon className="size-5" />}
                severity={k.severity}
                loading={isLoading}
              />
            )
          },
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
          <div className="mb-3 text-sm font-bold">توان عملیاتی و خطا</div>
          <MetricChart
            loading={tLoading}
            series={traffic?.series ?? {}}
            defs={[
              { key: "app.rps", label: "RPS", color: "var(--chart-2)", unit: "rps" },
              { key: "app.error_rate", label: "نرخ خطا", color: "var(--chart-4)", unit: "percent" },
            ]}
            kind="line"
            height={240}
          />
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
          <div className="mb-3 text-sm font-bold">تأخیر (API و دیتابیس)</div>
          <MetricChart
            series={latency?.series ?? {}}
            defs={[
              { key: "app.latency.p50", label: "میانه", color: "var(--chart-2)", unit: "ms" },
              { key: "app.latency.p95", label: "p95", color: "var(--chart-1)", unit: "ms" },
              { key: "db.latency", label: "DB", color: "var(--chart-3)", unit: "ms" },
            ]}
            kind="area"
            height={240}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
        <div className="mb-4 text-sm font-bold">همه متریک‌های اپلیکیشن</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((k) => {
            const Icon = ICONS[k.name] ?? Server
            return (
              <KpiCard
                key={k.name}
                label={LABELS[k.name] ?? k.name}
                value={formatMetricValue(k.value, k.unit)}
                icon={<Icon className="size-4" />}
                severity={k.severity}
                loading={isLoading}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
