"use client"

import {
  Activity,
  AlertTriangle,
  Bug,
  Gauge,
  Server,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react"
import { KpiCard } from "../kpi-card"
import { HealthGrid, type ServiceHealth } from "../health-grid"
import { ActivityFeed } from "../activity-feed"
import { MetricChart } from "../metric-chart"
import { useOpsData } from "../use-ops-data"
import { formatMetricValue } from "@/lib/monitoring/format"
import { formatNumber } from "@/lib/format"
import { ScoreGauge } from "../score-gauge"

type Overview = {
  overall: string
  servicesUp: number
  servicesTotal: number
  score: number
  requests: number
  errors: number
  errorRate: number
  avgLatencyMs: number | null
  rps: number | null
  cacheHitRatio: number | null
  openAlerts: number
  unresolvedErrors: number
  business: { ordersPerMin: number; revenueWindow: number; activeUsers: number }
  health: ServiceHealth[]
}

type SeriesResp = { series: Record<string, { t: string; value: number }[]> }

export function OverviewTab() {
  const { data: ov, isLoading } = useOpsData<Overview>("/api/v1/admin/ops/overview", {
    on: ["metrics", "health", "alert", "alert_resolved"],
    refreshInterval: 10000,
  })

  const { data: sysSeries, isLoading: sysLoading } = useOpsData<SeriesResp>(
    "/api/v1/admin/ops/metrics?series=system.cpu.usage,system.mem.usage&range=1h",
    { on: ["metrics"], refreshInterval: 20000 },
  )

  const { data: appSeries } = useOpsData<SeriesResp>(
    "/api/v1/admin/ops/metrics?series=app.rps,app.error_rate&range=1h",
    { on: ["metrics"], refreshInterval: 20000 },
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Headline KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="امتیاز سلامت سیستم"
          value={ov ? `${ov.score}/100` : undefined}
          icon={<Gauge className="size-5" />}
          severity={ov ? (ov.score >= 80 ? "ok" : ov.score >= 50 ? "warn" : "critical") : "ok"}
          loading={isLoading}
          hint={ov ? `${ov.servicesUp} از ${ov.servicesTotal} سرویس سالم` : undefined}
        />
        <KpiCard
          label="درخواست در ثانیه"
          value={ov ? formatMetricValue(ov.rps ?? 0, "rps") : undefined}
          icon={<Zap className="size-5" />}
          loading={isLoading}
          hint={ov ? `${formatNumber(ov.requests)} درخواست در بازه` : undefined}
        />
        <KpiCard
          label="نرخ خطا"
          value={ov ? formatMetricValue((ov.errorRate ?? 0) * 100, "percent") : undefined}
          icon={<AlertTriangle className="size-5" />}
          severity={ov ? (ov.errorRate > 0.05 ? "critical" : ov.errorRate > 0.02 ? "warn" : "ok") : "ok"}
          loading={isLoading}
          hint={ov ? `${formatNumber(ov.errors)} خطا` : undefined}
        />
        <KpiCard
          label="میانگین تأخیر API"
          value={ov ? formatMetricValue(ov.avgLatencyMs ?? 0, "ms") : undefined}
          icon={<Timer className="size-5" />}
          severity={ov ? ((ov.avgLatencyMs ?? 0) > 800 ? "critical" : (ov.avgLatencyMs ?? 0) > 300 ? "warn" : "ok") : "ok"}
          loading={isLoading}
        />
      </div>

      {/* Score gauge + charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Gauge className="size-4 text-primary" />
            کارت امتیاز عملکرد
          </div>
          <ScoreGauge score={ov?.score ?? 0} loading={isLoading} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-secondary/60 p-2">
              <p className="text-muted-foreground">هشدارهای باز</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-destructive">
                {ov ? formatNumber(ov.openAlerts) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-secondary/60 p-2">
              <p className="text-muted-foreground">خطاهای حل‌نشده</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                {ov ? formatNumber(ov.unresolvedErrors) : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Server className="size-4 text-primary" />
            منابع سرور (۱ ساعت اخیر)
          </div>
          <MetricChart
            loading={sysLoading}
            series={sysSeries?.series ?? {}}
            defs={[
              { key: "system.cpu.usage", label: "CPU", color: "var(--chart-3)", unit: "percent" },
              { key: "system.mem.usage", label: "حافظه", color: "var(--chart-1)", unit: "percent" },
            ]}
            kind="area"
            height={200}
          />
        </div>
      </div>

      {/* App throughput + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="size-4 text-primary" />
            ترافیک و نرخ خطا (۱ ساعت اخیر)
          </div>
          <MetricChart
            series={appSeries?.series ?? {}}
            defs={[
              { key: "app.rps", label: "RPS", color: "var(--chart-2)", unit: "rps" },
              { key: "app.error_rate", label: "نرخ خطا", color: "var(--chart-4)", unit: "percent" },
            ]}
            kind="line"
            height={200}
          />
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Activity className="size-4 text-primary" />
            فعالیت زنده
          </div>
          <ActivityFeed className="max-h-72 overflow-y-auto" />
        </div>
      </div>

      {/* Health grid */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Bug className="size-4 text-primary" />
          وضعیت سرویس‌ها
        </div>
        <HealthGrid services={ov?.health} loading={isLoading} />
      </div>
    </div>
  )
}
