"use client"

import { Crown, Sparkles } from "lucide-react"
import { formatNumber, formatToman } from "@/lib/format"

const TIER_STYLES: Record<string, { ring: string; chip: string; glow: string }> = {
  STANDARD: { ring: "ring-border", chip: "bg-muted text-muted-foreground", glow: "bg-muted-foreground/10" },
  SILVER: { ring: "ring-slate-300/40", chip: "bg-slate-300/15 text-slate-300", glow: "bg-slate-300/10" },
  GOLD: { ring: "ring-primary/40", chip: "bg-primary/15 text-primary", glow: "bg-primary/15" },
  PLATINUM: { ring: "ring-cyan-300/40", chip: "bg-cyan-300/15 text-cyan-200", glow: "bg-cyan-300/10" },
  VIP: { ring: "ring-primary/50", chip: "bg-gold text-primary-foreground", glow: "bg-primary/20" },
}

export type RewardsSummary = {
  loyaltyPoints: number
  lifetimePoints: number
  totalSpent: string
  tier: string
  tierLabel: string
  loginStreak: number
  nextTier: string | null
  nextTierLabel: string | null
  nextThreshold: { points: number; spend: number } | null
}

export function VipTierCard({ summary }: { summary: RewardsSummary }) {
  const style = TIER_STYLES[summary.tier] ?? TIER_STYLES.STANDARD

  // Progress toward the next tier is the lower of the two ratios (points & spend),
  // because reaching the next tier requires meeting BOTH thresholds.
  const spent = Number(summary.totalSpent)
  let pointsPct = 100
  let spendPct = 100
  if (summary.nextThreshold) {
    pointsPct = summary.nextThreshold.points
      ? Math.min(100, Math.round((summary.lifetimePoints / summary.nextThreshold.points) * 100))
      : 100
    spendPct = summary.nextThreshold.spend
      ? Math.min(100, Math.round((spent / (summary.nextThreshold.spend * 1000)) * 100))
      : 100
  }
  const overallPct = Math.min(pointsPct, spendPct)

  return (
    <div className={`card-premium relative overflow-hidden rounded-2xl border border-border p-5 ring-1 ${style.ring}`}>
      <div className={`pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full blur-3xl ${style.glow}`} />

      <div className="relative z-[1] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${style.chip}`}>
            <Crown className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">سطح عضویت</p>
            <p className="text-lg font-extrabold text-foreground">{summary.tierLabel}</p>
          </div>
        </div>
        {summary.loginStreak > 1 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {formatNumber(summary.loginStreak)} روز متوالی
          </span>
        )}
      </div>

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

      {/* Progress to next tier */}
      {summary.nextTier ? (
        <div className="relative z-[1] mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">پیشرفت تا سطح {summary.nextTierLabel}</span>
            <span className="font-bold text-foreground">{formatNumber(overallPct)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="bg-gold h-full rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              امتیاز: {formatNumber(summary.lifetimePoints)} / {formatNumber(summary.nextThreshold?.points ?? 0)}
            </span>
            <span>
              خرید: {formatNumber(Math.round(pointsPct >= 0 ? spendPct : 0))}%
            </span>
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
