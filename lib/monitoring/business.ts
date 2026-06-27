import "server-only"
import { prisma } from "@/lib/db"

/**
 * Real business metrics, computed from the live database. No synthetic values:
 * every number is an aggregate over actual rows in a time window.
 */

export interface BusinessMetrics {
  ordersPerMin: number
  revenueWindow: number // Toman, over `windowMs`
  walletTxPerMin: number
  activeUsers: number // users active within the last 5 minutes
  giveawayActivity: number // entries within window
  auctionActivity: number // bids within window
  referralConversions: number // rewarded referrals within window
  vipMembers: number
  windowMs: number
}

const ACTIVE_WINDOW_MS = 5 * 60_000

export async function getBusinessMetrics(windowMs = 60 * 60_000): Promise<BusinessMetrics> {
  const now = Date.now()
  const windowStart = new Date(now - windowMs)
  const minuteStart = new Date(now - 60_000)
  const activeStart = new Date(now - ACTIVE_WINDOW_MS)

  const [
    ordersLastMin,
    revenueAgg,
    walletTxLastMin,
    activeUsers,
    giveawayActivity,
    auctionActivity,
    referralConversions,
    vipMembers,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: minuteStart } } }),
    prisma.order.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: windowStart }, status: { in: ["PAID", "DELIVERED"] } },
    }),
    prisma.walletTransaction.count({ where: { createdAt: { gte: minuteStart } } }),
    prisma.user.count({ where: { updatedAt: { gte: activeStart } } }),
    prisma.giveawayEntry.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.bid.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.user.count({ where: { referralRewarded: true, updatedAt: { gte: windowStart } } }),
    prisma.user.count({
      where: {
        vipManual: true,
        OR: [{ vipManualExpiresAt: null }, { vipManualExpiresAt: { gt: new Date() } }],
      },
    }),
  ])

  return {
    ordersPerMin: ordersLastMin,
    revenueWindow: revenueAgg._sum.amount != null ? Number(revenueAgg._sum.amount) : 0,
    walletTxPerMin: walletTxLastMin,
    activeUsers,
    giveawayActivity,
    auctionActivity,
    referralConversions,
    vipMembers,
    windowMs,
  }
}

/** Map business metrics to the registry metric keys for persistence. */
export function businessToSamples(b: BusinessMetrics): { name: string; value: number }[] {
  return [
    { name: "biz.orders_per_min", value: b.ordersPerMin },
    { name: "biz.revenue_window", value: b.revenueWindow },
    { name: "biz.wallet_tx_per_min", value: b.walletTxPerMin },
    { name: "biz.active_users", value: b.activeUsers },
    { name: "biz.giveaway_activity", value: b.giveawayActivity },
    { name: "biz.auction_activity", value: b.auctionActivity },
    { name: "biz.referral_conversions", value: b.referralConversions },
    { name: "biz.vip_members", value: b.vipMembers },
  ]
}
