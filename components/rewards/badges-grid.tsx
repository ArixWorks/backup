"use client"

import * as Icons from "lucide-react"
import { Lock } from "lucide-react"
import { formatNumber } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"

export type Badge = {
  code: string
  name: string
  description: string
  icon: string
  points: number
  earned: boolean
  awardedAt: string | null
}

function BadgeIcon({ name }: { name: string }) {
  const Icon = (Icons as Record<string, unknown>)[name] as Icons.LucideIcon | undefined
  const Resolved = Icon ?? Icons.Award
  return <Resolved className="h-6 w-6" />
}

export function BadgesGrid({ badges }: { badges: Badge[] }) {
  const { t } = useI18n()
  const earnedCount = badges.filter((b) => b.earned).length

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{t("rewards.achievements")}</h3>
        <span className="text-xs text-muted-foreground">
          {t("rewards.earnedOf", { earned: formatNumber(earnedCount), total: formatNumber(badges.length) })}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 web:sm:grid-cols-4 web:lg:grid-cols-6">
        {badges.map((badge) => (
          <div
            key={badge.code}
            title={badge.description}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors ${
              badge.earned
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-card opacity-60"
            }`}
          >
            <span
              className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${
                badge.earned ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}
            >
              <BadgeIcon name={badge.icon} />
              {!badge.earned && (
                <span className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                  <Lock className="h-3 w-3" />
                </span>
              )}
            </span>
            <p className="text-[11px] font-bold leading-tight text-foreground text-pretty">{badge.name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
