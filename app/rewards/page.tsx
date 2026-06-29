"use client"

import useSWR from "swr"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { VipTierCard, type RewardsSummary } from "@/components/rewards/vip-tier-card"
import { MissionsPanel, type Mission } from "@/components/rewards/missions-panel"
import { BadgesGrid, type Badge } from "@/components/rewards/badges-grid"
import { PointsHistory, type PointEntry } from "@/components/rewards/points-history"
import { useI18n } from "@/components/i18n-provider"

type RewardsData = {
  summary: RewardsSummary | null
  badges: Badge[]
  missions: Mission[]
  history: PointEntry[]
}

export default function RewardsPage() {
  const { user } = useSession()
  const { t } = useI18n()
  const { data, isLoading, mutate } = useSWR<{ data: RewardsData }>(
    user ? "/api/v1/rewards" : null,
    fetcher,
    { refreshInterval: 20000 },
  )

  const rewards = data?.data

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-5">
      <header className="mb-4">
        <h1 className="text-xl font-extrabold text-foreground">{t("rewards.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rewards.subtitle")}</p>
      </header>

      {isLoading || !rewards?.summary ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-5">
          <VipTierCard summary={rewards.summary} />

          <Tabs defaultValue="missions">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="missions">{t("rewards.tabMissions")}</TabsTrigger>
              <TabsTrigger value="badges">{t("rewards.tabBadges")}</TabsTrigger>
              <TabsTrigger value="history">{t("rewards.tabHistory")}</TabsTrigger>
            </TabsList>

            <TabsContent value="missions" className="mt-4">
              {rewards.missions.length > 0 ? (
                <MissionsPanel missions={rewards.missions} onClaimed={() => mutate()} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("rewards.noMissions")}
                </p>
              )}
            </TabsContent>

            <TabsContent value="badges" className="mt-4">
              <BadgesGrid badges={rewards.badges} />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <PointsHistory entries={rewards.history} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </main>
  )
}
