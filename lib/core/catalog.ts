import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { NotFoundError } from "./errors"
import { finalizeAuction } from "./auction"
import { getGlobalAuctionPolicy, resolveAuctionPolicy } from "./auction/policy"
import { smartBuyNowPrice } from "./auction/pricing"
import type { AuctionPolicy } from "./auction/types"

export type FlashSort = "newest" | "price_asc" | "price_desc" | "popular"

export interface FlashFilters {
  search?: string
  category?: string
  sort?: FlashSort
}

function flashOrderBy(sort?: FlashSort): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { fixedSale: { price: "asc" } }
    case "price_desc":
      return { fixedSale: { price: "desc" } }
    case "popular":
      return { fixedSale: { soldCount: "desc" } }
    default:
      return { createdAt: "desc" }
  }
}

export async function listFlashSales(filters: FlashFilters = {}) {
  const where: Prisma.ProductWhereInput = {
    saleMode: "FIXED_PRICE",
    active: true,
    hidden: false,
  }

  if (filters.category) where.category = filters.category

  const search = filters.search?.trim()
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { tags: { has: search.toLowerCase() } },
    ]
  }

  const products = await prisma.product.findMany({
    where,
    include: { fixedSale: true },
    orderBy: flashOrderBy(filters.sort),
  })
  return products.map(summarizeFlash)
}

/**
 * Distinct categories among active flash-sale products, with a product count
 * each — used to render category browse chips on the storefront.
 */
export async function listFlashCategories() {
  const grouped = await prisma.product.groupBy({
    by: ["category"],
    where: { saleMode: "FIXED_PRICE", active: true, hidden: false, category: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
  })
  return grouped
    .filter((g) => g.category)
    .map((g) => ({ category: g.category as string, count: g._count._all }))
}

export type FlashProductRow = {
  id: string
  slug: string
  title: string
  description: string | null
  category: string | null
  coverImage: string | null
  gallery: string[]
  tags: string[]
  createdAt: Date
  deliveryType: string
  links: unknown
  fixedSale: {
    price: bigint
    stock: number
    reservedStock: number
    purchaseLimit: number | null
    soldCount: number
    soldBaseline: number
    bulkMinQty: number | null
    bulkDiscountPercent: number | null
    startTime: Date | null
    endTime: Date | null
  } | null
}

export type ProductLink = { label: string; url: string }

function parseLinks(value: unknown): ProductLink[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (l): l is ProductLink =>
        !!l && typeof (l as any).label === "string" && typeof (l as any).url === "string",
    )
    .map((l) => ({ label: l.label, url: l.url }))
}

export function summarizeFlash(p: FlashProductRow) {
  const fs = p.fixedSale
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    category: p.category,
    coverImage: p.coverImage,
    deliveryType: p.deliveryType,
    links: parseLinks(p.links),
    price: fs?.price ?? 0n,
    stock: (fs?.stock ?? 0) - (fs?.reservedStock ?? 0),
    purchaseLimit: fs?.purchaseLimit ?? null,
    soldCount: fs?.soldCount ?? 0,
    soldBaseline: fs?.soldBaseline ?? 0,
    // Total units shown publicly (real sales + vanity baseline).
    soldDisplay: (fs?.soldCount ?? 0) + (fs?.soldBaseline ?? 0),
    bulkMinQty: fs?.bulkMinQty ?? null,
    bulkDiscountPercent: fs?.bulkDiscountPercent ?? null,
    startTime: fs?.startTime ?? null,
    endTime: fs?.endTime ?? null,
  }
}

export type FlashSaleSummary = ReturnType<typeof summarizeFlash>

/** Load a single fixed-price product card by its product id (or null). */
export async function getFlashProduct(productId: string): Promise<FlashSaleSummary | null> {
  const p = await prisma.product.findFirst({
    where: { id: productId, saleMode: "FIXED_PRICE", active: true, hidden: false },
    include: { fixedSale: true },
  })
  if (!p || !p.fixedSale) return null
  return summarizeFlash(p as unknown as FlashProductRow)
}

/**
 * Full detail view for a flash-sale product page: includes the de-duplicated
 * image gallery, tags, and a per-unit discounted price preview for bulk buys.
 * Accepts either the product id or the unguessable slug.
 */
export async function getFlashDetail(idOrSlug: string) {
  const p = await prisma.product.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      saleMode: "FIXED_PRICE",
      active: true,
      hidden: false,
    },
    include: { fixedSale: true },
  })
  if (!p || !p.fixedSale) return null

  const summary = summarizeFlash(p as unknown as FlashProductRow)
  const images = [p.coverImage, ...(p.gallery ?? [])].filter(
    (src, i, arr): src is string => !!src && arr.indexOf(src) === i,
  )
  const bulkUnitPrice =
    summary.bulkMinQty && summary.bulkDiscountPercent
      ? (summary.price * BigInt(100 - summary.bulkDiscountPercent)) / 100n
      : null

  const ratingAgg = await prisma.review.aggregate({
    where: { productId: p.id, hidden: false },
    _avg: { rating: true },
    _count: { _all: true },
  })

  return {
    ...summary,
    images,
    tags: p.tags ?? [],
    createdAt: p.createdAt,
    bulkUnitPrice,
    ratingAvg: ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 10) / 10 : null,
    ratingCount: ratingAgg._count._all,
  }
}

export type FlashSaleDetail = NonNullable<Awaited<ReturnType<typeof getFlashDetail>>>

export async function listAuctions() {
  const auctions = await prisma.auction.findMany({
    where: { product: { active: true, hidden: false } },
    include: { product: true, _count: { select: { bids: true } } },
    orderBy: { endTime: "asc" },
  })
  // Load the global policy once and resolve per-auction overrides, so smart
  // Buy Now pricing is consistent with what the engine enforces on purchase.
  const globalPolicy = await getGlobalAuctionPolicy()
  return auctions.map((a) => summarizeAuction(a, resolveAuctionPolicy(globalPolicy, a.policyJson)))
}

type AuctionSummaryInput = {
  id: string
  policyJson: string | null
  product: { slug: string; title: string; description: string | null; category: string | null; coverImage: string | null; deliveryType: string }
  startPrice: bigint
  currentPrice: bigint
  minimumIncrement: bigint
  buyNowPrice: bigint | null
  reservePrice: bigint | null
  winnerUserId: string | null
  finalPrice: bigint | null
  endReason: string | null
  startTime: Date
  endTime: Date
  status: string
  quantity: number
  antiSnipingSeconds: number
  _count: { bids: number }
}

function summarizeAuction(a: AuctionSummaryInput, policy?: AuctionPolicy) {
  const hasBids = a._count.bids > 0
  const currentPrice = hasBids ? a.currentPrice : a.startPrice
  // Bid increments stay on the existing per-auction column in this PR (tiered
  // increments land in PR3). Only Buy Now becomes smart/dynamic here.
  const minNextBid = hasBids ? a.currentPrice + a.minimumIncrement : a.startPrice

  // Smart Buy Now: recompute the offered price (and availability) from the live
  // market via the pricing engine. Falls back to the static column when no
  // policy is supplied (legacy callers not yet migrated).
  let buyNowPrice = a.buyNowPrice
  let buyNowAvailable = a.buyNowPrice != null
  if (policy) {
    const smart = smartBuyNowPrice(
      {
        startPrice: a.startPrice,
        currentPrice: a.currentPrice,
        hasBids,
        initialBuyNowPrice: a.buyNowPrice,
        reservePrice: a.reservePrice ?? null,
      },
      policy,
    )
    buyNowPrice = smart.price
    buyNowAvailable = smart.available
  }

  return {
    id: a.id,
    slug: a.product.slug,
    title: a.product.title,
    description: a.product.description,
    category: a.product.category,
    coverImage: a.product.coverImage,
    deliveryType: a.product.deliveryType,
    startPrice: a.startPrice,
    currentPrice,
    minimumIncrement: a.minimumIncrement,
    minNextBid,
    buyNowPrice,
    buyNowAvailable,
    hasReserve: a.reservePrice != null,
    reserveMet: a.reservePrice == null ? true : a.currentPrice >= a.reservePrice,
    // Authoritative settlement result — never inferred from the top bid.
    winnerUserId: a.winnerUserId,
    finalPrice: a.finalPrice,
    endReason: a.endReason,
    startTime: a.startTime,
    endTime: a.endTime,
    status: a.status,
    quantity: a.quantity,
    bidCount: a._count.bids,
    antiSnipingSeconds: a.antiSnipingSeconds,
  }
}

/** Public summary helper reused by the watchlist module. */
export function summarizeForWatchlist(a: AuctionSummaryInput, policy?: AuctionPolicy) {
  return summarizeAuction(a, policy)
}

/** Auction detail including (aliased) bid history. Lazily finalizes if ended. */
export async function getAuctionDetail(auctionId: string) {
  let auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { product: true, _count: { select: { bids: true } } },
  })
  if (!auction) throw new NotFoundError("Auction not found")

  // Lazy settlement: if the auction is past its end and not yet finalized.
  if (
    auction.status !== "FINALIZED" &&
    auction.status !== "CANCELLED" &&
    new Date() >= auction.endTime
  ) {
    try {
      await finalizeAuction(auction.id)
    } catch {
      /* ignore; will retry on next view or cron */
    }
    auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { product: true, _count: { select: { bids: true } } },
    })
  }
  if (!auction) throw new NotFoundError("Auction not found")

  const bids = await prisma.bid.findMany({
    where: { auctionId: auction.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { user: { select: { alias: true, displayName: true, photoUrl: true } } },
  })

  const policy = await resolveAuctionPolicy(await getGlobalAuctionPolicy(), auction.policyJson)

  // Resolve the winner's public identity from the authoritative winnerUserId
  // (never inferred from the top bid). Only surfaced once finalized.
  let winner: { alias: string; name: string; photoUrl: string | null } | null = null
  if (auction.winnerUserId) {
    const w = await prisma.user.findUnique({
      where: { id: auction.winnerUserId },
      select: { alias: true, displayName: true, photoUrl: true },
    })
    if (w) winner = { alias: w.alias, name: w.displayName || w.alias, photoUrl: w.photoUrl }
  }

  return {
    ...summarizeAuction(auction, policy),
    finalizedAt: auction.finalizedAt,
    winner,
    bids: bids.map((b) => ({
      id: b.id,
      amount: b.amount,
      // Show the participant's real name + Telegram profile photo. `alias`
      // stays as a stable fallback for accounts without a display name.
      alias: b.user.alias,
      name: b.user.displayName || b.user.alias,
      photoUrl: b.user.photoUrl,
      isAuto: b.isAuto,
      createdAt: b.createdAt,
    })),
  }
}

export async function getOrdersForUser(userId: string) {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { title: true, slug: true } },
      delivery: true,
    },
  })
  return orders.map((o) => ({
    id: o.id,
    publicId: o.publicId,
    title: o.product.title,
    type: o.type,
    status: o.status,
    amount: o.amount,
    quantity: o.quantity,
    createdAt: o.createdAt,
    delivery: o.delivery
      ? {
          method: o.delivery.method,
          status: o.delivery.status,
          payload: o.delivery.status === "DELIVERED" ? o.delivery.payload : null,
          error: o.delivery.error,
        }
      : null,
  }))
}
