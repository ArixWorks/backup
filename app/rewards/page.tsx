"use client"

import useSWR from "swr"
import { Crown } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { SignInRequired } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
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

  if (!user) {
    return <SignInRequired description={t("rewards.subtitle")} />
  }

  return (
    <div className="space-y-5">
      <PageHeader icon={Crown} title={t("rewards.title")} description={t("rewards.subtitle")} />

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
    </div>
  )
}
