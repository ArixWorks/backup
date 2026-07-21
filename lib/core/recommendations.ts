import { prisma } from "@/lib/db"
import { getLocalizedData } from "@/lib/i18n/content-translation"
import { summarizeFlash, type FlashProductRow, type FlashSaleSummary } from "./catalog"

/**
 * Behaviour-based product recommendations.
 *
 * Signal sources (per user):
 *  - categories/tags of products they have ordered
 *  - categories/tags of products they have bid on
 *  - categories they explicitly follow (CategoryFollow)
 *
 * We score every currently-available flash-sale product the user has NOT
 * already bought by how well its category/tags overlap those affinities, then
 * blend in a light popularity signal so cold-start users still get good picks.
 * Anonymous or signal-less users fall back to "most popular available".
 */

const POPULARITY_WEIGHT = 0.0001 // gentle tie-breaker vs. affinity score

async function buildAffinity(userId: string) {
  const [orders, bids, follows] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      select: { product: { select: { category: true, tags: true } } },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    prisma.bid.findMany({
      where: { userId },
      select: { auction: { select: { product: { select: { category: true, tags: true } } } } },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    prisma.categoryFollow.findMany({ where: { userId }, select: { category: true } }),
  ])

  const categoryScore = new Map<string, number>()
  const tagScore = new Map<string, number>()
  const bump = (map: Map<string, number>, key: string | null | undefined, by: number) => {
    if (!key) return
    map.set(key, (map.get(key) ?? 0) + by)
  }

  // Purchases are the strongest intent signal, then bids, then follows.
  for (const o of orders) {
    bump(categoryScore, o.product.category, 3)
    o.product.tags.forEach((t) => bump(tagScore, t, 2))
  }
  for (const b of bids) {
    const p = b.auction?.product
    bump(categoryScore, p?.category, 2)
    p?.tags.forEach((t) => bump(tagScore, t, 1))
  }
  for (const f of follows) bump(categoryScore, f.category, 2)

  return { categoryScore, tagScore }
}

export interface Recommendation extends FlashSaleSummary {
  reason: string
}

/**
 * Return up to `limit` recommended flash-sale products for a user (or globally
 * popular ones when `userId` is null / has no history).
 */
export async function recommendForUser(
  userId: string | null,
  limit = 6,
  locale = "fa",
): Promise<Recommendation[]> {
  // Candidate pool: available, visible flash-sale products with stock.
  const products = await prisma.product.findMany({
    where: { saleMode: "FIXED_PRICE", active: true, hidden: false },
    include: { fixedSale: true },
    take: 200,
  })
  const candidates = products.filter(
    (p) => p.fixedSale && p.fixedSale.stock - p.fixedSale.reservedStock > 0,
  )
  if (candidates.length === 0) return []

  // Products the user already bought are excluded from picks.
  let purchasedIds = new Set<string>()
  let affinity = { categoryScore: new Map<string, number>(), tagScore: new Map<string, number>() }
  if (userId) {
    const [purchased, aff] = await Promise.all([
      prisma.order.findMany({ where: { userId }, select: { productId: true } }),
      buildAffinity(userId),
    ])
    purchasedIds = new Set(purchased.map((o) => o.productId))
    affinity = aff
  }

  const hasSignal = affinity.categoryScore.size > 0 || affinity.tagScore.size > 0

  // Prefer products the user hasn't bought, but if excluding them would leave
  // too few picks (small catalogs, re-buyable digital goods), keep them so the
  // rail stays useful.
  const unbought = candidates.filter((p) => !purchasedIds.has(p.id))
  const pool = unbought.length >= limit ? unbought : candidates

  const scored = pool
    .map((p) => {
      const fs = p.fixedSale!
      const popularity = (fs.soldCount + fs.soldBaseline) * POPULARITY_WEIGHT
      let affinityScore = 0
      let topCategory: string | null = null
      let topCategoryScore = 0
      if (p.category) {
        const cs = affinity.categoryScore.get(p.category) ?? 0
        if (cs > 0) {
          affinityScore += cs
          topCategory = p.category
          topCategoryScore = cs
        }
      }
      for (const tag of p.tags) {
        affinityScore += affinity.tagScore.get(tag) ?? 0
      }
      return { p, score: affinityScore + popularity, affinityScore, topCategory, topCategoryScore }
    })
    .sort((a, b) => b.score - a.score)

  const top = scored.slice(0, limit)

  return Promise.all(top.map(async ({ p, affinityScore, topCategory }) => {
    const localized = await getLocalizedData({
      entityType: "product",
      entityId: p.id,
      locale,
      fallback: {
        title: p.title,
        description: p.description,
        category: p.category,
        tags: p.tags,
        links: p.links,
      },
    })
    const summary = summarizeFlash({ ...p, ...localized } as unknown as FlashProductRow)
    let reason: string
    if (hasSignal && affinityScore > 0 && topCategory) {
      reason = `چون به «${topCategory}» علاقه نشان داده‌اید`
    } else if (hasSignal && affinityScore > 0) {
      reason = "بر اساس فعالیت‌های شما"
    } else {
      reason = "محبوب میان کاربران"
    }
    return { ...summary, reason }
  }))
}
