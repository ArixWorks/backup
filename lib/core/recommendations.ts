import { prisma } from "@/lib/db"
import { getLocalizedData } from "@/lib/i18n/content-translation"
import { summarizeFlash, type FlashProductRow, type FlashSaleSummary } from "./catalog"
import { computeProductScore } from "./product-score"

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
  /** Blended product score (0-5) for the compact rating chip. */
  score: number
  hasScore: boolean
}

export interface RecommendOptions {
  /**
   * When set, results are "similar products" for this product: the seed itself
   * is excluded and candidates sharing its category/tags get a strong boost,
   * blended on top of the user's personal affinity. Without it, results are the
   * generic personalized "picked for you" rail.
   */
  seedProductId?: string | null
}

const SEED_CATEGORY_WEIGHT = 6 // seed-category match ranks a candidate highly
const SEED_TAG_WEIGHT = 2 // each shared tag with the seed adds up

/**
 * Return up to `limit` recommended flash-sale products for a user (or globally
 * popular ones when `userId` is null / has no history). When `seedProductId` is
 * provided the rail becomes "similar products" for that seed, still
 * personalized by the user's affinity.
 */
export async function recommendForUser(
  userId: string | null,
  limit = 6,
  locale = "fa",
  options: RecommendOptions = {},
): Promise<Recommendation[]> {
  const seedProductId = options.seedProductId ?? null

  // Candidate pool: available, visible flash-sale products with stock. Fetch the
  // seed's own category/tags in parallel so we can compute similarity.
  const [products, seed] = await Promise.all([
    prisma.product.findMany({
      where: { saleMode: "FIXED_PRICE", active: true, hidden: false },
      include: { fixedSale: true },
      take: 200,
    }),
    seedProductId
      ? prisma.product.findUnique({
          where: { id: seedProductId },
          select: { category: true, tags: true },
        })
      : Promise.resolve(null),
  ])
  const seedTags = new Set(seed?.tags ?? [])
  const candidates = products.filter(
    (p) =>
      p.fixedSale &&
      p.fixedSale.stock - p.fixedSale.reservedStock > 0 &&
      // Never recommend the product the user is currently viewing.
      p.id !== seedProductId,
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

      // Similarity to the seed product (only when seeded). This makes the rail
      // "products like this one", still nudged by personal affinity above.
      let similarityScore = 0
      if (seed) {
        if (p.category && seed.category && p.category === seed.category) {
          similarityScore += SEED_CATEGORY_WEIGHT
        }
        for (const tag of p.tags) {
          if (seedTags.has(tag)) similarityScore += SEED_TAG_WEIGHT
        }
      }

      return {
        p,
        score: affinityScore + similarityScore + popularity,
        affinityScore,
        similarityScore,
        topCategory,
        topCategoryScore,
      }
    })
    .sort((a, b) => b.score - a.score)

  const top = scored.slice(0, limit)

  return Promise.all(top.map(async ({ p, affinityScore, similarityScore, topCategory }) => {
    // Only the handful of returned cards need a rating, so per-item review +
    // favorites aggregates here stay cheap (bounded by `limit`).
    const [localized, ratingAgg, favoritesCount] = await Promise.all([
      getLocalizedData({
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
      }),
      prisma.review.aggregate({
        where: { productId: p.id, hidden: false },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.favorite.count({ where: { productId: p.id } }),
    ])
    const summary = summarizeFlash({ ...p, ...localized } as unknown as FlashProductRow)
    const { score, hasSignal: hasScore } = computeProductScore({
      ratingAvg: ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 10) / 10 : null,
      ratingCount: ratingAgg._count._all,
      soldCount: summary.soldCount,
      favoritesCount,
    })
    let reason: string
    if (hasSignal && affinityScore > 0 && topCategory) {
      reason = `چون به «${topCategory}» علاقه نشان داده‌اید`
    } else if (hasSignal && affinityScore > 0) {
      reason = "بر اساس فعالیت‌های شما"
    } else if (seed && similarityScore > 0) {
      reason = "مشابه این محصول"
    } else {
      reason = "محبوب میان کاربران"
    }
    return { ...summary, reason, score, hasScore }
  }))
}
