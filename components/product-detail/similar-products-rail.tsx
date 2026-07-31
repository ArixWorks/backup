"use client"

import useSWR from "swr"
import { Sparkles } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { FlashCard, type FlashSale } from "@/components/flash-card"
import { CardSkeleton } from "@/components/loading-skeleton"
import { Stagger, FadeItem } from "@/components/motion"
import { useI18n } from "@/components/i18n-provider"

type Recommendation = FlashSale & { reason: string }

/**
 * Personalized "similar products" rail for a product detail page. It seeds the
 * shared recommendation engine with the current product so results are
 * products *like this one*, re-ranked by the signed-in user's own affinity
 * (orders, bids, followed categories). Hides itself when there's nothing to
 * suggest. A horizontal snap-scroll keeps it compact on phones and expands to a
 * grid on the web desktop shell.
 */
export function SimilarProductsRail({ productId, limit = 8 }: { productId: string; limit?: number }) {
  const { locale, t } = useI18n()
  const { data, isLoading } = useSWR<{ data: Recommendation[] }>(
    `/api/v1/recommendations?limit=${limit}&seed=${productId}&locale=${locale}`,
    fetcher,
    { revalidateOnFocus: false },
  )

  const items = data?.data ?? []

  if (isLoading) {
    return (
      <section className="space-y-3">
        <Header t={t} />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-40 shrink-0 web:lg:w-auto">
              <CardSkeleton />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (items.length === 0) return null

  return (
    <section className="space-y-3">
      <Header t={t} />
      {/* Snap-scroll carousel on phones; a real grid on the web desktop shell. */}
      <Stagger className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] web:lg:mx-0 web:lg:grid web:lg:grid-cols-4 web:lg:overflow-visible web:lg:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((rec) => (
          <FadeItem
            key={rec.id}
            className="w-40 shrink-0 snap-start web:lg:w-auto"
          >
            <FlashCard sale={rec} compact />
          </FadeItem>
        ))}
      </Stagger>
    </section>
  )
}

function Header({ t }: { t: ReturnType<typeof useI18n>["t"] }) {
  return (
    <div className="flex items-center gap-2">
      <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
      <div className="flex min-w-0 flex-col">
        <h2 className="text-lg font-extrabold leading-tight">{t("detail.similar")}</h2>
        <p className="text-xs text-muted-foreground">{t("detail.similarSubtitle")}</p>
      </div>
    </div>
  )
}
