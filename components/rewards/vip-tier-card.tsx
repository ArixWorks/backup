"use client"

import { Sparkles, BadgePercent, Crown, CalendarClock } from "lucide-react"
import { formatNumber, formatToman } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"
import { MembershipBadge } from "@/components/membership-badge"
import { TIER_META, type Tier } from "@/lib/tiers"

export type RewardsSummary = {
  loyaltyPoints: number
  lifetimePoints: number
  totalSpent: string
  /** Effective tier (VIP when an active manual grant exists). */
  tier: Tier
  tierLabel: string
  /** Auto-earned tier, independent of VIP. */
  earnedTier: Tier
  earnedTierLabel: string
  vipActive: boolean
  vipManualExpiresAt: string | null
  discountPercent: number
  loginStreak: number
  nextTier: string | null
  nextTierLabel: string | null
  nextThreshold: { points: number; spend: number } | null
}

export function VipTierCard({ summary }: { summary: RewardsSummary }) {
  const { t } = useI18n()
  const meta = TIER_META[summary.tier] ?? TIER_META.STANDARD

  // Progress toward the next EARNED tier. A tier unlocks when EITHER the points
  // OR the spend threshold is met (matches the engine's combined rule), so the
  // displayed progress is the higher of the two ratios.
  const spent = Number(summary.totalSpent)
  let pointsPct = 100
  let spendPct = 100
  if (summary.nextThreshold) {
    pointsPct = summary.nextThreshold.points
      ? Math.min(100, Math.round((summary.lifetimePoints / summary.nextThreshold.points) * 100))
      : 0
    spendPct = summary.nextThreshold.spend
      ? Math.min(100, Math.round((spent / summary.nextThreshold.spend) * 100))
      : 0
  }
  const overallPct = summary.nextThreshold ? Math.max(pointsPct, spendPct) : 100

  const expiry = summary.vipManualExpiresAt ? new Date(summary.vipManualExpiresAt) : null

  return (
    <div className={`card-premium relative overflow-hidden rounded-2xl border p-5 ring-1 ${meta.border} ${meta.ring}`}>
      <div className={`pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full blur-3xl ${meta.glow}`} />

      <div className="relative z-[1] flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${meta.chip} ${meta.ring}`}>
            {summary.tier === "VIP" ? <Crown className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("membership.title")}</p>
            <p className="truncate text-lg font-extrabold text-foreground">{summary.tierLabel}</p>
          </div>
        </div>
        <MembershipBadge tier={summary.tier} />
      </div>

      {/* Perk row: tier discount + login streak. */}
      <div className="relative z-[1] mt-4 flex flex-wrap items-center gap-2">
        {summary.discountPercent > 0 ? (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.border} ${meta.text}`}>
            <BadgePercent className="h-3.5 w-3.5" />
            {t("membership.discount").replace("{n}", String(summary.discountPercent))}
          </span>
        ) : null}
        {summary.loginStreak > 1 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {formatNumber(summary.loginStreak)} روز متوالی
          </span>
        )}
      </div>

      {/* VIP exclusivity note (with optional expiry). */}
      {summary.vipActive ? (
        <div className="relative z-[1] mt-3 flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 p-2.5 text-xs font-semibold text-violet-600 dark:text-violet-300">
          <Crown className="h-4 w-4 shrink-0" />
          <span className="min-w-0">{t("membership.vipExclusive")}</span>
          {expiry ? (
            <span className="ms-auto inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium opacity-80">
              <CalendarClock className="h-3.5 w-3.5" />
              {expiry.toLocaleDateString("fa-IR")}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Points + spend stat row */}
      <div className="relative z-[1] mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-background/50 p-3">
          <p className="text-xs text-muted-foreground">امتیاز قابل استفاده</p>
          <p className="mt-0.5 text-xl font-extrabold text-primary">{formatNumber(summary.loyaltyPoints)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background/50 p-3">
          <p className="text-xs text-muted-foreground">مجموع خرید</p>
          <p className="mt-0.5 text-base font-bold text-foreground">{formatToman(summary.totalSpent)}</p>
        </div>
      </div>

      {/* Progress to next earned tier. When VIP is active we still show the
          earned-tier progress so the user knows their underlying level. */}
      {summary.nextTier ? (
        <div className="relative z-[1] mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">پیشرفت تا سطح {summary.nextTierLabel}</span>
            <span className="font-bold text-foreground">{formatNumber(overallPct)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${TIER_META[(summary.nextTier as Tier) ?? "STANDARD"]?.bar ?? "bg-gold"}`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              امتیاز: {formatNumber(summary.lifetimePoints)} / {formatNumber(summary.nextThreshold?.points ?? 0)}
            </span>
            <span>خرید: {formatNumber(spendPct)}%</span>
          </div>
        </div>
      ) : (
        <p className="relative z-[1] mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-center text-sm font-bold text-primary">
          به بالاترین سطح عضویت رسیده‌اید
        </p>
      )}
    </div>
  )
}
