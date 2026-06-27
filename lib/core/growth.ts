import { prisma } from "@/lib/db"
import { SETTING_KEYS, getSetting, toNumber } from "./settings"
import { VIP_TIER_LABELS } from "./gamification"
import type { VipTier } from "@prisma/client"

/** "YYYY-MM-DD" for a date in server-local time (matches lastLoginDay format). */
function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export interface GrowthAnalytics {
  // Referral funnel
  referral: {
    totalReferred: number
    joined: number
    converted: number
    /** % of referred users who reached first purchase. */
    conversionRate: number
    pointsAwarded: number
  }
  // Engagement
  engagement: {
    dau: number // distinct users active today (by lastLoginDay)
    activeLast7: number
    activeLast30: number
    /** % of users who logged in on more than one distinct day. */
    returningRate: number
    avgLoginStreak: number
  }
  // Notifications
  notifications: {
    total: number
    read: number
    openRate: number // % read
    last7: number
  }
  // VIP / loyalty
  loyalty: {
    totalPointsInCirculation: number
    vipMembers: number // anyone above STANDARD
    tierDistribution: { tier: VipTier; label: string; count: number }[]
    newVipLast30: number
  }
  // 14-day signup trend for the chart
  signupTrend: { date: string; count: number }[]
}

export async function getGrowthAnalytics(): Promise<GrowthAnalytics> {
  const now = new Date()
  const today = dayKey(now)
  const day7 = new Date(now.getTime() - 7 * 86_400_000)
  const day30 = new Date(now.getTime() - 30 * 86_400_000)
  const day7Key = dayKey(day7)

  const [
    totalReferred,
    referralJoined,
    referralConverted,
    pointsAgg,
    dau,
    activeLast7,
    returningUsers,
    totalUsers,
    streakAgg,
    notifTotal,
    notifRead,
    notifLast7,
    pointsCirculation,
    vipMembers,
    tierGroups,
    newVipLast30,
    signupRows,
  ] = await Promise.all([
    prisma.user.count({ where: { referredById: { not: null } } }),
    prisma.user.count({ where: { referredById: { not: null }, referralJoinRewarded: true } }),
    prisma.user.count({ where: { referredById: { not: null }, referralRewarded: true } }),
    prisma.pointLedger.aggregate({ where: { delta: { gt: 0 } }, _sum: { delta: true } }),
    prisma.user.count({ where: { lastLoginDay: today } }),
    prisma.user.count({ where: { lastLoginDay: { gte: day7Key } } }),
    // "Returning" = users with a login streak of 2+ distinct days.
    prisma.user.count({ where: { loginStreak: { gte: 2 } } }),
    prisma.user.count(),
    prisma.user.aggregate({ _avg: { loginStreak: true } }),
    prisma.notification.count(),
    prisma.notification.count({ where: { read: true } }),
    prisma.notification.count({ where: { createdAt: { gte: day7 } } }),
    prisma.user.aggregate({ _sum: { loyaltyPoints: true } }),
    prisma.user.count({ where: { vipTier: { not: "STANDARD" } } }),
    prisma.user.groupBy({ by: ["vipTier"], _count: { _all: true } }),
    prisma.user.count({ where: { vipSince: { gte: day30 } } }),
    prisma.user.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 14 * 86_400_000) } },
      select: { createdAt: true },
    }),
  ])

  const pointsPerReferral = toNumber(await getSetting(SETTING_KEYS.pointsPerReferral))

  // Active in last 30 days: lastLoginDay >= day30Key OR createdAt recent.
  const activeLast30 = await prisma.user.count({
    where: { lastLoginDay: { gte: dayKey(day30) } },
  })

  // Build EARNED tier distribution in canonical order. Legacy PLATINUM rows are
  // folded into DIAMOND. Exclusive VIP is an admin grant tracked separately.
  const tierOrder: VipTier[] = ["STANDARD", "BRONZE", "SILVER", "GOLD", "DIAMOND"]
  const tierCountMap = new Map<string, number>()
  for (const g of tierGroups) {
    const key = g.vipTier === "PLATINUM" ? "DIAMOND" : g.vipTier
    tierCountMap.set(key, (tierCountMap.get(key) ?? 0) + g._count._all)
  }
  const tierDistribution = tierOrder.map((tier) => ({
    tier,
    label: VIP_TIER_LABELS[tier],
    count: tierCountMap.get(tier) ?? 0,
  }))
  // Append the exclusive VIP membership (manual, active grants only).
  const vipActiveCount = await prisma.user.count({
    where: {
      vipManual: true,
      OR: [{ vipManualExpiresAt: null }, { vipManualExpiresAt: { gt: now } }],
    },
  })
  tierDistribution.push({ tier: "VIP", label: VIP_TIER_LABELS.VIP, count: vipActiveCount })

  // 14-day signup trend, zero-filled.
  const trendMap = new Map<string, number>()
  for (let i = 13; i >= 0; i--) {
    trendMap.set(dayKey(new Date(now.getTime() - i * 86_400_000)), 0)
  }
  for (const row of signupRows) {
    const k = dayKey(row.createdAt)
    if (trendMap.has(k)) trendMap.set(k, (trendMap.get(k) ?? 0) + 1)
  }
  const signupTrend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }))

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0)

  return {
    referral: {
      totalReferred,
      joined: referralJoined,
      converted: referralConverted,
      conversionRate: pct(referralConverted, totalReferred),
      pointsAwarded: referralConverted * pointsPerReferral,
    },
    engagement: {
      dau,
      activeLast7,
      activeLast30,
      returningRate: pct(returningUsers, totalUsers),
      avgLoginStreak: Math.round((streakAgg._avg.loginStreak ?? 0) * 10) / 10,
    },
    notifications: {
      total: notifTotal,
      read: notifRead,
      openRate: pct(notifRead, notifTotal),
      last7: notifLast7,
    },
    loyalty: {
      totalPointsInCirculation: pointsCirculation._sum.loyaltyPoints ?? 0,
      vipMembers,
      tierDistribution,
      newVipLast30,
    },
    signupTrend,
  }
}
