"use client"

import useSWR from "swr"
import { Sparkles } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { FlashCard, type FlashSale } from "@/components/flash-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Stagger, FadeItem } from "@/components/motion"
import { useI18n } from "@/components/i18n-provider"

type Recommendation = FlashSale & { reason: string }

/**
 * Personalized "picked for you" rail. Pulls behaviour-based recommendations and
 * renders them with the standard FlashCard plus a short reason chip. Hides
 * itself entirely when there's nothing to suggest.
 */
export function RecommendedRail({ limit = 6 }: { limit?: number }) {
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: Recommendation[] }>(
    `/api/v1/recommendations?limit=${limit}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  const items = data?.data ?? []

  if (isLoading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-extrabold">{t("home.recommended")}</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      </section>
    )
  }

  if (items.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-extrabold">{t("home.recommended")}</h2>
      </div>
      <Stagger className="grid grid-cols-2 gap-3">
        {items.map((rec) => (
          <FadeItem key={rec.id} className="flex flex-col">
            <span className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              {rec.reason}
            </span>
            <FlashCard sale={rec} />
          </FadeItem>
        ))}
      </Stagger>
    </section>
  )
}
