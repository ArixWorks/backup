"use client"

import { Cpu, MemoryStick, HardDrive, Network, Activity, Gauge } from "lucide-react"
import { KpiCard } from "../kpi-card"
import { MetricChart } from "../metric-chart"
import { useOpsData } from "../use-ops-data"
import { formatMetricValue } from "@/lib/monitoring/format"

type Kpi = { name: string; value: number | null; unit?: string; severity: "ok" | "warn" | "critical" }
type KpiResp = { kpis: Kpi[] }
type SeriesResp = { series: Record<string, { t: string; value: number }[]> }

const ICONS: Record<string, typeof Cpu> = {
  "system.cpu.usage": Cpu,
  "system.cpu.load1": Gauge,
  "system.mem.usage": MemoryStick,
  "system.disk.usage": HardDrive,
  "system.net.rx": Network,
  "system.net.tx": Network,
  "system.net.latency": Activity,
}

const LABELS: Record<string, string> = {
  "system.cpu.usage": "مصرف CPU",
  "system.cpu.load1": "بار سیستم",
  "system.mem.usage": "مصرف حافظه",
  "system.disk.usage": "مصرف دیسک",
  "system.net.rx": "ترافیک ورودی",
  "system.net.tx": "ترافیک خروجی",
  "system.net.latency": "تأخیر شبکه",
  "system.proc.count": "پردازه‌ها",
  "system.fd.open": "File Descriptorها",
  "system.uptime": "آپ‌تایم",
}

export function InfraTab({ range }: { range: string }) {
  const { data: kpiData, isLoading } = useOpsData<KpiResp>(
    "/api/v1/admin/ops/metrics?category=infra",
    { on: ["metrics"], refreshInterval: 15000 },
  )

  const { data: cpuMem, isLoading: cmLoading } = useOpsData<SeriesResp>(
    `/api/v1/admin/ops/metrics?series=system.cpu.usage,system.mem.usage,system.disk.usage&range=${range}`,
    { on: ["metrics"], refreshInterval: 20000 },
  )

  const { data: net } = useOpsData<SeriesResp>(
    `/api/v1/admin/ops/metrics?series=system.net.rx,system.net.tx&range=${range}`,
    { on: ["metrics"], refreshInterval: 20000 },
  )

  const kpis = kpiData?.kpis ?? []
  const featured = ["system.cpu.usage", "system.mem.usage", "system.disk.usage", "system.net.latency"]
  const featuredKpis = featured
    .map((n) => kpis.find((k) => k.name === n))
    .filter(Boolean) as Kpi[]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(isLoading ? featured.map((n) => ({ name: n, value: null, severity: "ok" as const })) : featuredKpis).map(
          (k) => {
            const Icon = ICONS[k.name] ?? Activity
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
          <div className="mb-3 text-sm font-bold">مصرف منابع (CPU / حافظه / دیسک)</div>
          <MetricChart
            loading={cmLoading}
            series={cpuMem?.series ?? {}}
            defs={[
              { key: "system.cpu.usage", label: "CPU", color: "var(--chart-3)", unit: "percent" },
              { key: "system.mem.usage", label: "حافظه", color: "var(--chart-1)", unit: "percent" },
              { key: "system.disk.usage", label: "دیسک", color: "var(--chart-2)", unit: "percent" },
            ]}
            kind="area"
            height={240}
          />
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
          <div className="mb-3 text-sm font-bold">پهنای باند شبکه</div>
          <MetricChart
            series={net?.series ?? {}}
            defs={[
              { key: "system.net.rx", label: "ورودی", color: "var(--chart-2)", unit: "bytesPerSec" },
              { key: "system.net.tx", label: "خروجی", color: "var(--chart-3)", unit: "bytesPerSec" },
            ]}
            kind="area"
            height={240}
          />
        </div>
      </div>

      {/* Full KPI list */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
        <div className="mb-4 text-sm font-bold">همه متریک‌های زیرساخت</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((k) => {
            const Icon = ICONS[k.name] ?? Activity
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
