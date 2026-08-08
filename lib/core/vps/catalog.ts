import "server-only"
import type { Prisma, VpsOffer, VpsOfferStockStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { NotFoundError, ValidationError } from "@/lib/core/errors"
import { slugify } from "@/lib/core/slug"
import { sanitizeRichHtml } from "@/lib/rich-content/sanitize"

/**
 * VPS catalog. The single rule that shapes this file: **provider economics are
 * never public.** `toPublicOffer` deliberately omits `providerCostCents`,
 * `providerCurrency`, `providerLabel` and `backupProviderLabel`; only
 * `toAdminOffer` includes them. Every storefront/DTO path must go through
 * `toPublicOffer` so a reseller's margin can never leak to a buyer.
 */

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

export interface PublicVpsOffer {
  id: string
  name: string
  slug: string
  location: string
  cpu: string
  ram: string
  storage: string
  storageType: string
  bandwidth: string
  ipv4: number
  ipv6: boolean
  portSpeed: string | null
  os: string[]
  durationDays: number
  priceIrt: bigint
  listPriceIrt: bigint | null
  currency: string
  description: string
  features: unknown
  coverImage: string | null
  gallery: string[]
  stockStatus: VpsOfferStockStatus
  estimatedDeliveryText: string | null
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string[]
  ogImageUrl: string | null
  sortOrder: number
}

/** Public DTO — NEVER includes provider cost/label fields. */
export function toPublicOffer(o: VpsOffer): PublicVpsOffer {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    location: o.location,
    cpu: o.cpu,
    ram: o.ram,
    storage: o.storage,
    storageType: o.storageType,
    bandwidth: o.bandwidth,
    ipv4: o.ipv4,
    ipv6: o.ipv6,
    portSpeed: o.portSpeed,
    os: o.os,
    durationDays: o.durationDays,
    priceIrt: o.priceIrt,
    listPriceIrt: o.listPriceIrt,
    currency: o.currency,
    description: o.description,
    features: o.features,
    coverImage: o.coverImage,
    gallery: o.gallery,
    stockStatus: o.stockStatus,
    estimatedDeliveryText: o.estimatedDeliveryText,
    seoTitle: o.seoTitle,
    seoDescription: o.seoDescription,
    seoKeywords: o.seoKeywords,
    ogImageUrl: o.ogImageUrl,
    sortOrder: o.sortOrder,
  }
}

/** Admin DTO — includes internal economics + active flag + timestamps. */
export function toAdminOffer(o: VpsOffer) {
  return {
    ...toPublicOffer(o),
    active: o.active,
    providerCostCents: o.providerCostCents,
    providerCurrency: o.providerCurrency,
    providerLabel: o.providerLabel,
    backupProviderLabel: o.backupProviderLabel,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// Slug uniqueness (mirrors lib/core/slug ensureUnique, scoped to VpsOffer)
// ---------------------------------------------------------------------------

async function ensureUniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = base || `vps-${Math.random().toString(36).slice(2, 8)}`
  let candidate = root
  let n = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.vpsOffer.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!existing || existing.id === ignoreId) return candidate
    n += 1
    candidate = `${root}-${n}`
  }
}

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

export interface VpsOfferInput {
  name: string
  slug?: string | null
  location: string
  cpu: string
  ram: string
  storage: string
  storageType?: string
  bandwidth: string
  ipv4?: number
  ipv6?: boolean
  portSpeed?: string | null
  os?: string[]
  durationDays?: number
  priceIrt: bigint
  listPriceIrt?: bigint | null
  description?: string
  features?: unknown
  coverImage?: string | null
  gallery?: string[]
  stockStatus?: VpsOfferStockStatus
  estimatedDeliveryText?: string | null
  active?: boolean
  sortOrder?: number
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string[]
  ogImageUrl?: string | null
  providerCostCents?: number | null
  providerCurrency?: string | null
  providerLabel?: string | null
  backupProviderLabel?: string | null
}

function normalizeWritable(input: Partial<VpsOfferInput>): Prisma.VpsOfferUncheckedUpdateInput {
  const data: Prisma.VpsOfferUncheckedUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.location !== undefined) data.location = input.location
  if (input.cpu !== undefined) data.cpu = input.cpu
  if (input.ram !== undefined) data.ram = input.ram
  if (input.storage !== undefined) data.storage = input.storage
  if (input.storageType !== undefined) data.storageType = input.storageType
  if (input.bandwidth !== undefined) data.bandwidth = input.bandwidth
  if (input.ipv4 !== undefined) data.ipv4 = input.ipv4
  if (input.ipv6 !== undefined) data.ipv6 = input.ipv6
  if (input.portSpeed !== undefined) data.portSpeed = input.portSpeed
  if (input.os !== undefined) data.os = input.os
  if (input.durationDays !== undefined) data.durationDays = input.durationDays
  if (input.priceIrt !== undefined) data.priceIrt = input.priceIrt
  if (input.listPriceIrt !== undefined) data.listPriceIrt = input.listPriceIrt
  if (input.description !== undefined) data.description = sanitizeRichHtml(input.description ?? "")
  if (input.features !== undefined) data.features = (input.features ?? []) as Prisma.InputJsonValue
  if (input.coverImage !== undefined) data.coverImage = input.coverImage
  if (input.gallery !== undefined) data.gallery = input.gallery
  if (input.stockStatus !== undefined) data.stockStatus = input.stockStatus
  if (input.estimatedDeliveryText !== undefined) data.estimatedDeliveryText = input.estimatedDeliveryText
  if (input.active !== undefined) data.active = input.active
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
  if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle
  if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription
  if (input.seoKeywords !== undefined) data.seoKeywords = input.seoKeywords
  if (input.ogImageUrl !== undefined) data.ogImageUrl = input.ogImageUrl
  if (input.providerCostCents !== undefined) data.providerCostCents = input.providerCostCents
  if (input.providerCurrency !== undefined) data.providerCurrency = input.providerCurrency
  if (input.providerLabel !== undefined) data.providerLabel = input.providerLabel
  if (input.backupProviderLabel !== undefined) data.backupProviderLabel = input.backupProviderLabel
  return data
}

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

export async function listOffersAdmin() {
  const offers = await prisma.vpsOffer.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] })
  return offers.map(toAdminOffer)
}

export async function getOfferAdmin(id: string) {
  const offer = await prisma.vpsOffer.findUnique({ where: { id } })
  if (!offer) throw new NotFoundError("پلن VPS یافت نشد")
  return toAdminOffer(offer)
}

export async function createOffer(input: VpsOfferInput) {
  if (input.priceIrt <= 0n) throw new ValidationError("قیمت باید بزرگ‌تر از صفر باشد")
  const slug = await ensureUniqueSlug(slugify(input.slug || input.name))
  const offer = await prisma.vpsOffer.create({
    data: {
      name: input.name,
      slug,
      location: input.location,
      cpu: input.cpu,
      ram: input.ram,
      storage: input.storage,
      storageType: input.storageType ?? "NVMe",
      bandwidth: input.bandwidth,
      ipv4: input.ipv4 ?? 1,
      ipv6: input.ipv6 ?? false,
      portSpeed: input.portSpeed ?? null,
      os: input.os ?? [],
      durationDays: input.durationDays ?? 30,
      priceIrt: input.priceIrt,
      listPriceIrt: input.listPriceIrt ?? null,
      description: sanitizeRichHtml(input.description ?? ""),
      features: (input.features ?? []) as Prisma.InputJsonValue,
      coverImage: input.coverImage ?? null,
      gallery: input.gallery ?? [],
      stockStatus: input.stockStatus ?? "ON_REQUEST",
      estimatedDeliveryText: input.estimatedDeliveryText ?? null,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      seoKeywords: input.seoKeywords ?? [],
      ogImageUrl: input.ogImageUrl ?? null,
      providerCostCents: input.providerCostCents ?? null,
      providerCurrency: input.providerCurrency ?? null,
      providerLabel: input.providerLabel ?? null,
      backupProviderLabel: input.backupProviderLabel ?? null,
    },
  })
  return toAdminOffer(offer)
}

export async function updateOffer(id: string, input: Partial<VpsOfferInput>) {
  const existing = await prisma.vpsOffer.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new NotFoundError("پلن VPS یافت نشد")
  if (input.priceIrt !== undefined && input.priceIrt <= 0n) {
    throw new ValidationError("قیمت باید بزرگ‌تر از صفر باشد")
  }
  const data = normalizeWritable(input)
  if (input.slug !== undefined && input.slug) {
    data.slug = await ensureUniqueSlug(slugify(input.slug), id)
  }
  const offer = await prisma.vpsOffer.update({ where: { id }, data })
  return toAdminOffer(offer)
}

export async function deleteOffers(ids: string[]) {
  // Offers with orders are kept for audit integrity; only unused ones delete.
  const withOrders = await prisma.vpsOrder.findMany({
    where: { offerId: { in: ids } },
    select: { offerId: true },
    distinct: ["offerId"],
  })
  const blocked = new Set(withOrders.map((o) => o.offerId))
  const deletable = ids.filter((id) => !blocked.has(id))
  if (deletable.length) await prisma.vpsOffer.deleteMany({ where: { id: { in: deletable } } })
  // Offers that can't be deleted are deactivated instead so they leave the store.
  const deactivated = ids.filter((id) => blocked.has(id))
  if (deactivated.length) {
    await prisma.vpsOffer.updateMany({ where: { id: { in: deactivated } }, data: { active: false } })
  }
  return { deleted: deletable.length, deactivated: deactivated.length }
}

export async function setOfferActive(id: string, active: boolean) {
  const existing = await prisma.vpsOffer.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new NotFoundError("پلن VPS یافت نشد")
  const offer = await prisma.vpsOffer.update({ where: { id }, data: { active } })
  return toAdminOffer(offer)
}

export async function reorderOffers(order: { id: string; sortOrder: number }[]) {
  await prisma.$transaction(
    order.map((o) => prisma.vpsOffer.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder } })),
  )
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Public catalog (used by the storefront in Phase 2)
// ---------------------------------------------------------------------------

export interface PublicOfferFilter {
  location?: string
  maxPriceIrt?: bigint
  minRamGb?: number
}

export async function listPublicOffers(filter: PublicOfferFilter = {}) {
  const where: Prisma.VpsOfferWhereInput = {
    active: true,
    stockStatus: { not: "DISABLED" },
  }
  if (filter.location) where.location = filter.location
  if (filter.maxPriceIrt !== undefined) where.priceIrt = { lte: filter.maxPriceIrt }
  const offers = await prisma.vpsOffer.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  })
  return offers.map(toPublicOffer)
}

export async function getPublicOffer(slug: string) {
  const offer = await prisma.vpsOffer.findUnique({ where: { slug } })
  if (!offer || !offer.active || offer.stockStatus === "DISABLED") {
    throw new NotFoundError("پلن VPS یافت نشد")
  }
  return toPublicOffer(offer)
}

/** Distinct active locations, for storefront filter chips. */
export async function listOfferLocations(): Promise<string[]> {
  const rows = await prisma.vpsOffer.findMany({
    where: { active: true, stockStatus: { not: "DISABLED" } },
    select: { location: true },
    distinct: ["location"],
    orderBy: { location: "asc" },
  })
  return rows.map((r) => r.location)
}
