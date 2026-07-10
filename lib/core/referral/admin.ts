import { prisma } from "@/lib/db"
import type { ReferralRewardStatus } from "@prisma/client"

/**
 * Admin read models for the Level-2 referral engine. Pure queries used by the
 * admin panel — all mutations go through reward.ts (approve/reject/block).
 */

export interface RewardRow {
  id: string
  status: ReferralRewardStatus
  amount: string
  currency: string
  riskScore: number
  riskReason: string | null
  createdAt: string
  creditedAt: string | null
  beneficiary: { id: string; name: string }
  middle: { id: string; name: string }
  trigger: { id: string; name: string }
}

function nameOf(u?: { displayName: string | null; alias: string | null } | null): string {
  return u?.displayName || u?.alias || "کاربر"
}

/** Paginated reward list, optionally filtered by status. */
export async function listReferralRewards(opts?: {
  status?: ReferralRewardStatus
  limit?: number
}): Promise<RewardRow[]> {
  const take = Math.min(Math.max(opts?.limit ?? 100, 1), 200)
  const rewards = await prisma.referralReward.findMany({
    where: opts?.status ? { status: opts.status } : undefined,
    orderBy: [{ createdAt: "desc" }],
    take,
  })

  // Resolve the three parties for every reward in one round-trip.
  const ids = Array.from(
    new Set(rewards.flatMap((r) => [r.beneficiaryId, r.middleUserId, r.triggerUserId])),
  )
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, alias: true },
  })
  const byId = new Map(users.map((u) => [u.id, u]))

  return rewards.map((r) => ({
    id: r.id,
    status: r.status,
    amount: r.amount.toString(),
    currency: r.currency,
    riskScore: r.riskScore,
    riskReason: r.riskReason,
    createdAt: r.createdAt.toISOString(),
    creditedAt: r.creditedAt?.toISOString() ?? null,
    beneficiary: { id: r.beneficiaryId, name: nameOf(byId.get(r.beneficiaryId)) },
    middle: { id: r.middleUserId, name: nameOf(byId.get(r.middleUserId)) },
    trigger: { id: r.triggerUserId, name: nameOf(byId.get(r.triggerUserId)) },
  }))
}

/** Counts per lifecycle status, for the queue summary chips. */
export async function referralRewardStatusCounts(): Promise<Record<string, number>> {
  const grouped = await prisma.referralReward.groupBy({
    by: ["status"],
    _count: { _all: true },
  })
  const out: Record<string, number> = {}
  for (const g of grouped) out[g.status] = g._count._all
  return out
}
