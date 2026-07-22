import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { NotFoundError } from "./errors"
import { finalizeAuction, handleWinnerDefault } from "./auction"
import { getGlobalAuctionPolicy, resolveAuctionPolicy } from "./auction/policy"
import { smartBuyNowPrice, incrementForPrice, nextMinimumBid } from "./auction/pricing"
import { isTerminalStatus } from "./auction/lifecycle"
import { computeReserveDisplay } from "./auction/reserve"
import type { AuctionPolicy, AuctionEndReason } from "./auction/types"
import { getLocalizedData } from "@/lib/i18n/content-translation"

export type FlashSort = "newest" | "price_asc" | "price_desc" | "popular"

export interface FlashFilters {
  search?: string
  category?: string
  sort?: FlashSort
  locale?: string
}

async function localizedProduct<T extends { id: string; title: string; description: string | null; category: string | null; tags: string[]; links: unknown }>(product: T, locale = "fa") {
  const localized = await getLocalizedData({
    entityType: "product",
    entityId: product.id,
    locale,
    fallback: {
      title: product.title,
      description: product.description,
      category: product.category,
      tags: product.tags,
      links: product.links,
    },
  })
  return { ...product, ...localized }
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
  const localized = await Promise.all(products.map((product) => localizedProduct(product, filters.locale)))
  return localized.map((product) => summarizeFlash(product as unknown as FlashProductRow))
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
    compareAtPrice: bigint | null
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
    // Original "was" price for the strike-through discount display. Only shown
    // when strictly greater than the selling price; null otherwise.
    compareAtPrice: fs?.compareAtPrice != null && fs.compareAtPrice > (fs?.price ?? 0n) ? fs.compareAtPrice : null,
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
export async function getFlashDetail(idOrSlug: string, locale = "fa") {
  const p = await prisma.product.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      saleMode: "FIXED_PRICE",
      active: true,
      hidden: false,
    },
    include: {
      fixedSale: true,
      variants: { where: { active: true }, orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
    },
  })
  if (!p || !p.fixedSale) return null

  const translatedProduct = await localizedProduct(p, locale)
  const summary = summarizeFlash(translatedProduct as unknown as FlashProductRow)

  // Public sale plans: expose available (non-reserved) stock only, never the
  // reserved holds. Prices stay BigInt and are serialized to strings upstream.
  const variants = (p.variants ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    attributes: (v.attributes ?? null) as Record<string, unknown> | null,
    description: v.description,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    stock: Math.max(0, v.stock - v.reservedStock),
    purchaseLimit: v.purchaseLimit,
    deliveryType: v.deliveryType,
    soldCount: v.soldCount,
  }))
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
    variants,
    ratingAvg: ratingAgg._avg.rating ? Math.round(ratingAgg._avg.rating * 10) / 10 : null,
    ratingCount: ratingAgg._count._all,
  }
}

export type FlashSaleDetail = NonNullable<Awaited<ReturnType<typeof getFlashDetail>>>

export async function listAuctions(locale = "fa") {
  const auctions = await prisma.auction.findMany({
    where: { product: { active: true, hidden: false } },
    include: { product: true, _count: { select: { bids: true } } },
    orderBy: { endTime: "asc" },
  })
  // Load the global policy once and resolve per-auction overrides, so smart
  // Buy Now pricing is consistent with what the engine enforces on purchase.
  const globalPolicy = await getGlobalAuctionPolicy()
  const localized = await Promise.all(
    auctions.map(async (auction) => ({ ...auction, product: await localizedProduct(auction.product, locale) })),
  )
  return localized.map((a) => summarizeAuction(a, resolveAuctionPolicy(globalPolicy, a.policyJson)))
}

type AuctionSummaryInput = {
  id: string
  productId: string
  policyJson: string | null
  product: { slug: string; title: string; description: string | null; category: string | null; coverImage: string | null; deliveryType: string }
  startPrice: bigint
  currentPrice: bigint
  minimumIncrement: bigint
  buyNowPrice: bigint | null
  reservePrice: bigint | null
  // Admin-set "real market value" reference anchor (presentational only).
  estimatedValue: bigint | null
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
  // Tiered/fixed bid increments (PR3): when a policy is available, the minimum
  // next bid and the advertised increment come from the pricing engine, so the
  // UI shows exactly what `placeBid` enforces. Falls back to the per-auction
  // column for legacy callers that don't pass a policy.
  const minNextBid = policy
    ? nextMinimumBid({ startPrice: a.startPrice, currentPrice: a.currentPrice, hasBids }, policy)
    : hasBids
      ? a.currentPrice + a.minimumIncrement
      : a.startPrice
  const advertisedIncrement = policy
    ? incrementForPrice(currentPrice, policy)
    : a.minimumIncrement

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
    productId: a.productId,
    slug: a.product.slug,
    title: a.product.title,
    description: a.product.description,
    category: a.product.category,
    coverImage: a.product.coverImage,
    deliveryType: a.product.deliveryType,
    startPrice: a.startPrice,
    currentPrice,
    minimumIncrement: advertisedIncrement,
    minNextBid,
    buyNowPrice,
    buyNowAvailable,
    // Real market value shown as a reference anchor. Only surfaced when set and
    // strictly greater than the live price so it always reads as a "worth" hint.
    estimatedValue: a.estimatedValue != null && a.estimatedValue > currentPrice ? a.estimatedValue : null,
    // Reserve display (PR7): computed server-side against the policy visibility
    // so hidden data (exact amount, and in HIDDEN mode even the met/not-met
    // status) never reaches the client. Legacy callers with no policy fall back
    // to the default HIDDEN_OR_PARTIAL behaviour.
    reserve: computeReserveDisplay({
      reservePrice: a.reservePrice ?? null,
      currentPrice: a.currentPrice,
      visibility: policy?.reservePriceVisibility ?? "HIDDEN_OR_PARTIAL",
      isTerminal: isTerminalStatus(a.status),
      endReason: (a.endReason as AuctionEndReason | null) ?? null,
    }),
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
    // Proxy / auto-bidding is offered in the UI only for single-item auctions
    // and only when the resolved policy enables it (PR5).
    proxyBidEnabled: policy ? policy.proxyBidEnabled && a.quantity === 1 : false,
  }
}

/** Public summary helper reused by the watchlist module. */
export function summarizeForWatchlist(a: AuctionSummaryInput, policy?: AuctionPolicy) {
  return summarizeAuction(a, policy)
}

/** Auction detail including (aliased) bid history. Lazily finalizes if ended. */
export async function getAuctionDetail(auctionId: string, locale = "fa") {
  let auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: { product: true, _count: { select: { bids: true } } },
  })
  if (!auction) throw new NotFoundError("Auction not found")

  // Lazy settlement: if the auction is past its end and not yet in a terminal
  // state. Uses the lifecycle engine so every terminal status (FINALIZED, SOLD,
  // SETTLED, RESERVE_NOT_MET, CANCELLED, …) is treated as "already settled".
  if (!isTerminalStatus(auction.status) && new Date() >= auction.endTime) {
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

  // Lazy winner-default: a PAYMENT_PENDING auction (deposit / partial-freeze
  // mode) whose payment or second-chance deadline has elapsed is defaulted
  // on-read, mirroring the lazy-finalize above. This makes the winner-default
  // lifecycle robust even if the scheduled cron is delayed or unavailable.
  if (
    auction.status === "PAYMENT_PENDING" &&
    auction.paymentDeadlineAt &&
    new Date() >= auction.paymentDeadlineAt
  ) {
    try {
      await handleWinnerDefault(auction.id)
    } catch {
      /* ignore; the cron will retry */
    }
    auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { product: true, _count: { select: { bids: true } } },
    })
    if (!auction) throw new NotFoundError("Auction not found")
  }

  const bids = await prisma.bid.findMany({
    where: { auctionId: auction.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { user: { select: { alias: true, displayName: true, photoUrl: true } } },
  })

  const policy = resolveAuctionPolicy(await getGlobalAuctionPolicy(), auction.policyJson)

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

  const translatedProduct = await localizedProduct(auction.product, locale)

  return {
    ...summarizeAuction({ ...auction, product: translatedProduct }, policy),
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
      delivery: {
        include: { tutorial: { select: { id: true, title: true, slug: true } } },
      },
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
          tutorial: o.delivery.tutorial
            ? {
                title: o.delivery.tutorial.title,
                href: `/tutorials/${o.delivery.tutorial.slug}`,
              }
            : null,
        }
      : null,
  }))
}
