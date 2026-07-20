"use client"

import { use } from "react"
import useSWR from "swr"
import { ArrowRight, Gift } from "lucide-react"
import Link from "next/link"
import { fetcher } from "@/lib/api-client"
import { EmptyState } from "@/components/empty-state"
import { GiveawayDetail, type GiveawayDetailData } from "@/components/giveaway-detail"
import { CardSkeleton } from "@/components/loading-skeleton"
import { Stagger, FadeItem } from "@/components/motion"
import { useI18n } from "@/components/i18n-provider"

export default function GiveawayLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { t, locale } = useI18n()
  const { slug } = use(params)
  const { data, isLoading, mutate } = useSWR<{ data: GiveawayDetailData }>(
    `/api/v1/giveaways/${slug}?locale=${locale}`,
    fetcher,
    { refreshInterval: 8000 },
  )

  const giveaway = data?.data

  return (
    <Stagger className="space-y-5">
      <FadeItem>
        <Link
          href="/giveaways"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          {t("giveaways.all")}
        </Link>
      </FadeItem>

      {isLoading ? (
        <CardSkeleton className="h-96" />
      ) : !giveaway ? (
        <FadeItem>
          <EmptyState
            icon={Gift}
            title={t("giveaways.notFound")}
            actionLabel={t("giveaways.all")}
            actionHref="/giveaways"
          />
        </FadeItem>
      ) : (
        <GiveawayDetail giveaway={giveaway} onChange={() => mutate()} />
      )}
    </Stagger>
  )
}
