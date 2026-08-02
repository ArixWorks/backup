"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Search, SearchX, TrendingUp, Globe, Send, RefreshCw, Loader2, AlertCircle, PackagePlus } from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface SearchTermStat {
  query: string
  count: number
  avgResults: number
  zeroResult: boolean
  lastSearchedAt: string
}
interface SearchInsights {
  rangeDays: number
  totals: {
    total: number
    unique: number
    zeroResultSearches: number
    zeroResultRate: number
    web: number
    telegram: number
  }
  topTerms: SearchTermStat[]
  zeroResultTerms: SearchTermStat[]
}

const RANGES = [
  { days: 7, label: "۷ روز" },
  { days: 30, label: "۳۰ روز" },
  { days: 90, label: "۹۰ روز" },
]

// Localize an ASCII integer into fa-IR grouped digits for display.
const faInt = (n: number) => new Intl.NumberFormat("fa-IR").format(n)

export function SearchInsightsManager() {
  const [rangeDays, setRangeDays] = useState(30)
  const [reindexing, setReindexing] = useState(false)
  const { data, isLoading, error } = useSWR<{ data: SearchInsights }>(
    `/api/v1/admin/ai/search-insights?days=${rangeDays}`,
    fetcher,
    { refreshInterval: 30000 },
  )
  const insights = data?.data

  async function handleReindex() {
    setReindexing(true)
    try {
      const res = await apiPost<{ data: { embedded: number; failed: number } }>(
        "/api/v1/admin/ai/search-insights",
        { action: "reindex" },
      )
      toast.success(`نمایه‌سازی انجام شد: ${faInt(res.data.embedded)} محصول به‌روزرسانی شد`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "نمایه‌سازی ناموفق بود")
    } finally {
      setReindexing(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls: range toggle + reindex */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setRangeDays(r.days)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                rangeDays === r.days
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleReindex} disabled={reindexing}>
          {reindexing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          نمایه‌سازی مجدد محصولات
        </Button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          خطا در دریافت اطلاعات. لطفاً دوباره تلاش کنید.
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : insights ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={<Search className="size-4" />} label="کل جستجوها" value={faInt(insights.totals.total)} />
            <StatCard icon={<TrendingUp className="size-4" />} label="عبارات یکتا" value={faInt(insights.totals.unique)} />
            <StatCard
              icon={<SearchX className="size-4" />}
              label="بدون نتیجه"
              value={`${faInt(insights.totals.zeroResultSearches)}`}
              hint={`${faInt(insights.totals.zeroResultRate)}٪ از کل`}
              tone="warning"
            />
            <StatCard
              icon={<Globe className="size-4" />}
              label="وب / تلگرام"
              value={`${faInt(insights.totals.web)} / ${faInt(insights.totals.telegram)}`}
            />
          </div>

          {/* Zero-result demand list — the priority "products to add" section */}
          <section className="rounded-2xl border border-warning/40 bg-warning/5 p-4">
            <header className="mb-3 flex items-center gap-2">
              <PackagePlus className="size-5 text-warning" />
              <div>
                <h2 className="text-sm font-extrabold text-foreground">نیازهای پاسخ‌داده‌نشده</h2>
                <p className="text-xs text-muted-foreground">
                  کاربران این‌ها را جستجو کردند ولی چیزی پیدا نشد. کاندیدای اصلی افزودن به فروشگاه.
                </p>
              </div>
            </header>
            {insights.zeroResultTerms.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                عالی! همه‌ی جستجوها حداقل یک نتیجه داشتند.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {insights.zeroResultTerms.map((term) => (
                  <li key={term.query} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="truncate font-semibold text-foreground">{term.query}</span>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {faInt(term.count)} بار
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Top searches overall */}
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-extrabold text-foreground">پرتکرارترین جستجوها</h2>
            {insights.topTerms.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">هنوز جستجویی ثبت نشده است.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {insights.topTerms.map((term) => (
                  <li key={term.query} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{term.query}</span>
                      {term.zeroResult && (
                        <Badge variant="outline" className="shrink-0 border-warning/50 text-warning">
                          بدون نتیجه
                        </Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground tabular-nums">
                      <span>میانگین {faInt(term.avgResults)} نتیجه</span>
                      <Badge variant="secondary">{faInt(term.count)} بار</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: "default" | "warning"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border p-4",
        tone === "warning" ? "border-warning/40 bg-warning/5" : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-lg",
          tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary",
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-lg font-extrabold tabular-nums text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-warning">{hint}</p>}
      </div>
    </div>
  )
}
