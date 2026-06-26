"use client"

import useSWR from "swr"
import Link from "next/link"
import { Gift, Trophy, ChevronLeft } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { GiveawayCard, type GiveawaySummary } from "@/components/giveaway-card"
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
        <header className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 text-xl font-extrabold">
              <Gift className="h-5 w-5 text-primary" />
              {t("giveaways.title")}
            </h1>
            <Link
              href="/giveaways/wins"
              className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary/70"
            >
              <Trophy className="h-3.5 w-3.5 text-primary" />
              جوایز من
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("giveaways.subtitle")}</p>
        </header>
      </FadeItem>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="shimmer card-premium h-72 w-full rounded-2xl border border-border" />
          ))}
        </div>
      ) : giveaways.length === 0 ? (
        <FadeItem>
          <div className="card-premium rounded-2xl border border-dashed border-border/80 p-10 text-center">
            <Gift className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">در حال حاضر قرعه‌کشی فعالی وجود ندارد.</p>
          </div>
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
                <h2 className="text-sm font-bold text-muted-foreground">قرعه‌کشی‌های پیشین</h2>
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
