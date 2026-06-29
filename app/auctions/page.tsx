"use client"

import useSWR from "swr"
import { Gavel } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { AuctionCard, type AuctionSummary } from "@/components/auction-card"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/components/i18n-provider"

export default function AuctionsPage() {
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: AuctionSummary[] }>("/api/v1/auctions", fetcher, {
    refreshInterval: 8000,
  })
  const auctions = data?.data ?? []

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Gavel className="h-5 w-5 text-primary" />
          {t("auctions.title")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("auctions.subtitle")}
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title={t("auctions.empty")}
          description={t("auctions.emptyDesc")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {auctions.map((a) => (
            <AuctionCard key={a.id} auction={a} />
          ))}
        </div>
      )}
    </div>
  )
}
