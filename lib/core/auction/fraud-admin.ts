import { prisma } from "@/lib/db"
import { audit } from "../audit"

export interface AuctionFraudFlagView {
  id: string
  auctionId: string
  auctionTitle: string
  userId: string
  actorName: string
  score: number
  reason: string
  signals: string[]
  action: string
  blocked: boolean
  resolvedAt: string | null
  createdAt: string
}

export interface AuctionFraudOverview {
  openCount: number
  blockedCount: number
  flags: AuctionFraudFlagView[]
}

/**
 * Admin anti-fraud overview (PR6): recent auction risk flags enriched with the
 * actor's display name and the auction's product title. Unresolved flags first.
 */
export async function getAuctionFraudOverview(limit = 50): Promise<AuctionFraudOverview> {
  const [flags, openCount, blockedCount] = await Promise.all([
    prisma.auctionRiskFlag.findMany({
      orderBy: [{ resolvedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      take: limit,
    }),
    prisma.auctionRiskFlag.count({ where: { resolvedAt: null } }),
    prisma.auctionRiskFlag.count({ where: { blocked: true } }),
  ])

  const userIds = [...new Set(flags.map((f) => f.userId))]
  const auctionIds = [...new Set(flags.map((f) => f.auctionId))]
  const [users, auctions] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, alias: true },
    }),
    prisma.auction.findMany({
      where: { id: { in: auctionIds } },
      select: { id: true, product: { select: { title: true } } },
    }),
  ])
  const nameOf = new Map(users.map((u) => [u.id, u.displayName || u.alias || "کاربر"]))
  const titleOf = new Map(auctions.map((a) => [a.id, a.product?.title ?? "مزایده"]))

  return {
    openCount,
    blockedCount,
    flags: flags.map((f) => ({
      id: f.id,
      auctionId: f.auctionId,
      auctionTitle: titleOf.get(f.auctionId) ?? "مزایده",
      userId: f.userId,
      actorName: nameOf.get(f.userId) ?? "کاربر",
      score: f.score,
      reason: f.reason,
      signals: f.signals,
      action: f.action,
      blocked: f.blocked,
      resolvedAt: f.resolvedAt?.toISOString() ?? null,
      createdAt: f.createdAt.toISOString(),
    })),
  }
}

/** Mark a flag as reviewed/resolved by an admin. */
export async function resolveAuctionFraudFlag(flagId: string, adminId: string): Promise<void> {
  const flag = await prisma.auctionRiskFlag.findUnique({ where: { id: flagId } })
  if (!flag || flag.resolvedAt) return
  await prisma.auctionRiskFlag.update({
    where: { id: flagId },
    data: { resolvedAt: new Date() },
  })
  await audit({
    actorId: adminId,
    action: "auction.fraud.resolve",
    entity: "auctionRiskFlag",
    entityId: flagId,
    meta: { auctionId: flag.auctionId, userId: flag.userId, score: flag.score },
  })
}
