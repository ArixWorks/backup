"use client"

import useSWR from "swr"
import { BellRing, Zap } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { AuctionCard, type AuctionSummary } from "@/components/auction-card"
import { WatchedProducts } from "@/components/watched-products"
import { EmptyState, SignInRequired } from "@/components/empty-state"
import { CardListSkeleton } from "@/components/loading-skeleton"
import { PageHeader } from "@/components/page-header"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"

export default function WatchlistPage() {
  const { user } = useSession()
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: AuctionSummary[] }>(
    user ? "/api/v1/watchlist" : null,
    fetcher,
    { refreshInterval: 8000 },
  )
  const auctions = data?.data ?? []

  return (
    <div className="space-y-5">
      <PageHeader icon={BellRing} title={t("watchlist.title")} description={t("watchlist.subtitle")} />

      {!user ? (
        <SignInRequired description={t("watchlist.signInRequired")} />
      ) : (
        <div className="space-y-7">
          {/* Watched auctions */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <BellRing className="h-4 w-4 text-primary" />
              {t("auctions.title")}
            </h2>
            {isLoading ? (
              <CardListSkeleton count={2} />
            ) : auctions.length === 0 ? (
              <EmptyState
                icon={BellRing}
                title={t("watchlist.empty")}
                description={t("watchlist.emptyDesc")}
                actionLabel={t("watchlist.browse")}
                actionHref="/auctions"
              />
            ) : (
              <div className="grid gap-3 web:sm:grid-cols-2 web:xl:grid-cols-3">
                {auctions.map((a) => (
                  <AuctionCard key={a.id} auction={a} />
                ))}
              </div>
            )}
          </section>

          {/* Watched flash products (back-in-stock alerts) */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Zap className="h-4 w-4 text-primary" />
              {t("watchlist.flashProducts")}
            </h2>
            <WatchedProducts />
          </section>
        </div>
      )}
    </div>
  )
}
