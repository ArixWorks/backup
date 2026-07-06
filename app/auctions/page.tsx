"use client"

import useSWR from "swr"
import { Gavel } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { AuctionCard, type AuctionSummary } from "@/components/auction-card"
import { EmptyState } from "@/components/empty-state"
import { CardListSkeleton } from "@/components/loading-skeleton"
import { PageHeader } from "@/components/page-header"
import { useI18n } from "@/components/i18n-provider"

export default function AuctionsPage() {
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: AuctionSummary[] }>("/api/v1/auctions", fetcher, {
    refreshInterval: 8000,
  })
  const auctions = data?.data ?? []

  return (
    <div className="space-y-5">
      <PageHeader icon={Gavel} title={t("auctions.title")} description={t("auctions.subtitle")} />

      {isLoading ? (
        <CardListSkeleton count={3} />
      ) : auctions.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title={t("auctions.empty")}
          description={t("auctions.emptyDesc")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((a) => (
            <AuctionCard key={a.id} auction={a} />
          ))}
        </div>
      )}
    </div>
  )
}
