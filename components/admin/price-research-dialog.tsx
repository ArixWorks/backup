"use client"

import { useState } from "react"
import { Sparkles, Loader2, TrendingUp, Search, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { apiPost } from "@/lib/api-client"
import { formatToman } from "@/lib/format"

type Scenario = "found" | "similar_only" | "not_found"

interface ResearchSource {
  title?: string
  url?: string
  date?: string
  snippet?: string
}

interface PriceResearch {
  scenario: Scenario
  recommendedPrice: number | null
  priceRangeMin: number | null
  priceRangeMax: number | null
  sampleCount: number
  confidence: "high" | "medium" | "low"
  headline: string
  advice: string
  sources: ResearchSource[]
}

const SCENARIO_META: Record<Scenario, { label: string; icon: typeof CheckCircle2; tone: string }> = {
  found: { label: "نمونهٔ دقیق پیدا شد", icon: CheckCircle2, tone: "text-emerald-500" },
  similar_only: { label: "فقط موارد مشابه پیدا شد", icon: AlertTriangle, tone: "text-amber-500" },
  not_found: { label: "نمونهٔ مشابه پیدا نشد", icon: AlertTriangle, tone: "text-amber-500" },
}

const CONFIDENCE_LABEL: Record<PriceResearch["confidence"], string> = {
  high: "اطمینان بالا",
  medium: "اطمینان متوسط",
  low: "اطمینان پایین",
}

/**
 * Inline AI price-research assistant. Renders a small Sparkles button intended
 * to sit inside the "compareAtPrice" (real price) field. On click it opens a
 * dialog, runs live web research (Persian virtual-account marketplaces, recent
 * only) and presents a senior-reseller-style recommendation. The admin can
 * approve (auto-fills the field via `onApply`) or cancel and type manually.
 */
export function PriceResearchDialog({
  title,
  planName,
  category,
  currentPrice,
  onApply,
}: {
  title: string
  planName?: string | null
  category?: string | null
  currentPrice?: number | null
  onApply: (price: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PriceResearch | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (!title || title.trim().length < 2) {
      toast.error("ابتدا عنوان محصول را وارد کنید")
      return
    }
    setOpen(true)
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await apiPost<{ ok: boolean; data: PriceResearch }>(
        "/api/v1/admin/products/price-research",
        {
          title: title.trim(),
          planName: planName || undefined,
          category: category || undefined,
          currentPrice: currentPrice ?? undefined,
        },
      )
      setResult(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "تحقیق قیمت ناموفق بود. می‌توانید مبلغ را دستی وارد کنید.")
    } finally {
      setLoading(false)
    }
  }

  function apply() {
    if (result?.recommendedPrice != null) {
      onApply(result.recommendedPrice)
      toast.success("مبلغ پیشنهادی در فیلد قیمت اصلی ثبت شد")
      setOpen(false)
    }
  }

  const meta = result ? (SCENARIO_META[result.scenario] ?? SCENARIO_META.similar_only) : null
  const ScenarioIcon = meta?.icon ?? Search

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
        aria-label="تحقیق قیمت با هوش مصنوعی"
      >
        <Sparkles className="size-3.5" />
        قیمت‌یابی هوشمند
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              دستیار قیمت‌گذاری هوشمند
            </DialogTitle>
            <DialogDescription className="text-right">
              جستجوی زندهٔ قیمت روز در سایت‌های فارسی فروش اکانت مجازی
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="relative">
                <Loader2 className="size-10 animate-spin text-primary" />
                <Search className="absolute inset-0 m-auto size-4 text-primary" />
              </div>
              <p className="text-sm font-medium">در حال تحقیق در اینترنت…</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                منابع فارسی و فروشگاه‌های ایرانی را برای قیمت‌های به‌روز این محصول بررسی می‌کنم. این کار ممکن است چند لحظه طول بکشد.
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="space-y-3 py-4">
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {result && !loading && meta && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <ScenarioIcon className={`size-4 ${meta.tone}`} />
                <span className="text-sm font-semibold">{meta.label}</span>
                <span className="mr-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {CONFIDENCE_LABEL[result.confidence]}
                </span>
              </div>

              <p className="text-sm font-medium text-pretty">{result.headline}</p>

              {result.recommendedPrice != null && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <p className="text-[11px] text-muted-foreground">قیمت اصلی پیشنهادی</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums text-primary">
                    {formatToman(result.recommendedPrice)}
                    <span className="mr-1 text-xs font-normal text-muted-foreground">تومان</span>
                  </p>
                  {result.priceRangeMin != null && result.priceRangeMax != null && (
                    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                      بازهٔ مشاهده‌شده: {formatToman(result.priceRangeMin)} تا {formatToman(result.priceRangeMax)} تومان
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    بر پایهٔ {result.sampleCount.toLocaleString("fa-IR")} منبع به‌روز
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">مشاورهٔ فروشنده</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-pretty">{result.advice}</p>
              </div>

              {result.sources.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">منابع بررسی‌شده</p>
                  <ul className="space-y-1">
                    {result.sources.slice(0, 6).map((s, i) => (
                      <li key={i} className="truncate text-[11px]">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="size-3 shrink-0" />
                          <span className="truncate">{s.title || s.url}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
            {result && !loading && result.recommendedPrice != null && (
              <Button type="button" onClick={apply} className="gap-1.5">
                <CheckCircle2 className="size-4" />
                ثبت این مبلغ
              </Button>
            )}
            {error && !loading && (
              <Button type="button" variant="secondary" onClick={start}>
                تلاش دوباره
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {result || error ? "لغو / ورود دستی" : "انصراف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
