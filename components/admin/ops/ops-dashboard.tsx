"use client"

import { useEffect, useState } from "react"
import {
  Activity,
  Server,
  LayoutGrid,
  TrendingUp,
  AlertTriangle,
  Bug,
  Download,
  RefreshCw,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OpsRealtimeProvider } from "./ops-realtime"
import { ConnectionBadge } from "./connection-badge"
import { OverviewTab } from "./tabs/overview-tab"
import { InfraTab } from "./tabs/infra-tab"
import { AppTab } from "./tabs/app-tab"
import { BusinessTab } from "./tabs/business-tab"
import { ErrorsTab } from "./tabs/errors-tab"
import { AlertsTab } from "./tabs/alerts-tab"

const RANGES = [
  { value: "1h", label: "۱ ساعت" },
  { value: "6h", label: "۶ ساعت" },
  { value: "24h", label: "۲۴ ساعت" },
  { value: "7d", label: "۷ روز" },
  { value: "30d", label: "۳۰ روز" },
]

const EXPORT_METRICS =
  "system.cpu.usage,system.mem.usage,app.rps,app.error_rate,app.latency.p95,biz.revenue_window"

const TABS = ["overview", "infra", "app", "business", "errors", "alerts"]
const RANGE_VALUES = RANGES.map((r) => r.value)

/** Read initial tab/range from the URL so a refresh keeps the operator's place. */
function readInitialState(): { tab: string; range: string } {
  if (typeof window === "undefined") return { tab: "overview", range: "24h" }
  const params = new URLSearchParams(window.location.search)
  const tab = params.get("tab")
  const range = params.get("range")
  return {
    tab: tab && TABS.includes(tab) ? tab : "overview",
    range: range && RANGE_VALUES.includes(range) ? range : "24h",
  }
}

export function OpsDashboard() {
  const initial = readInitialState()
  const [tab, setTab] = useState(initial.tab)
  const [range, setRange] = useState(initial.range)

  // Keep the URL query string in sync (replaceState — no history spam, survives
  // reloads, and makes the current view shareable/bookmarkable).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set("tab", tab)
    params.set("range", range)
    const next = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, "", next)
  }, [tab, range])

  function exportData(format: "csv" | "xlsx" | "pdf") {
    const url = `/api/v1/admin/ops/export?format=${format}&metrics=${encodeURIComponent(
      EXPORT_METRICS,
    )}&range=${range}`
    window.open(url, "_blank")
  }

  return (
    <OpsRealtimeProvider>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Activity className="size-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-balance">
                مرکز عملیات و پایش
              </h1>
            </div>
            <p className="text-sm text-muted-foreground text-pretty">
              پایش لحظه‌ای زیرساخت، سرویس‌ها، خطاها و معیارهای کسب‌وکار
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ConnectionBadge />
            <Select value={range} onValueChange={(v) => setRange(v ?? "24h")}>
              <SelectTrigger className="w-32" aria-label="بازه زمانی">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Download data-icon="inline-start" />
                    خروجی
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>دریافت خروجی داده‌ها</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => exportData("csv")}>
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportData("xlsx")}>
                    Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportData("pdf")}>
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="gap-6">
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList className="w-max">
              <TabsTrigger value="overview">
                <LayoutGrid data-icon="inline-start" />
                نمای کلی
              </TabsTrigger>
              <TabsTrigger value="infra">
                <Server data-icon="inline-start" />
                زیرساخت
              </TabsTrigger>
              <TabsTrigger value="app">
                <Activity data-icon="inline-start" />
                اپلیکیشن
              </TabsTrigger>
              <TabsTrigger value="business">
                <TrendingUp data-icon="inline-start" />
                کسب‌وکار
              </TabsTrigger>
              <TabsTrigger value="errors">
                <Bug data-icon="inline-start" />
                خطاها
              </TabsTrigger>
              <TabsTrigger value="alerts">
                <AlertTriangle data-icon="inline-start" />
                هشدارها
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <OverviewTab range={range} />
          </TabsContent>
          <TabsContent value="infra">
            <InfraTab range={range} />
          </TabsContent>
          <TabsContent value="app">
            <AppTab range={range} />
          </TabsContent>
          <TabsContent value="business">
            <BusinessTab range={range} />
          </TabsContent>
          <TabsContent value="errors">
            <ErrorsTab />
          </TabsContent>
          <TabsContent value="alerts">
            <AlertsTab />
          </TabsContent>
        </Tabs>
      </div>
    </OpsRealtimeProvider>
  )
}
