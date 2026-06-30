"use client"

import useSWR from "swr"
import Link from "next/link"
import { Gift, Trophy, ChevronLeft } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { GiveawayCard, type GiveawaySummary } from "@/components/giveaway-card"
import { EmptyState } from "@/components/empty-state"
import { CardSkeleton } from "@/components/loading-skeleton"
import { PageHeader } from "@/components/page-header"
import { Stagger, FadeItem } from "@/components/motion"

export default function GiveawaysPage() {
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: GiveawaySummary[] }>(
    "/api/v1/giveaways",
    fetcher,
    { refreshInterval: 10000 },
  )

  const giveaways = data?.data ?? []
  const active = giveaways.filter((g) => g.status === "ACTIVE" || g.status === "SCHEDULED" || g.status === "PAUSED")
  const past = giveaways.filter((g) => !["ACTIVE", "SCHEDULED", "PAUSED"].includes(g.status))

  return (
    <Stagger className="space-y-6">
      <FadeItem>
        <PageHeader
          icon={Gift}
          title={t("giveaways.title")}
          description={t("giveaways.subtitle")}
          action={
            <Link
              href="/giveaways/wins"
              className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary/70"
            >
              <Trophy className="h-3.5 w-3.5 text-primary" />
              {t("giveaways.myWins")}
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          }
        />
      </FadeItem>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : giveaways.length === 0 ? (
        <FadeItem>
          <EmptyState
            icon={Gift}
            title={t("giveaways.empty")}
            description={t("giveaways.emptyDesc")}
          />
        </FadeItem>
      ) : (
        <>
          {active.length > 0 && (
            <FadeItem>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((g) => (
                  <GiveawayCard key={g.id} giveaway={g} />
                ))}
              </div>
            </FadeItem>
          )}

          {past.length > 0 && (
            <FadeItem>
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-muted-foreground">{t("giveaways.past")}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {past.map((g) => (
                    <GiveawayCard key={g.id} giveaway={g} />
                  ))}
                </div>
              </section>
            </FadeItem>
          )}
        </>
      )}
    </Stagger>
  )
}
