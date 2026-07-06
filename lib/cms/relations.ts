import { prisma } from "@/lib/db"
import { requireContentType } from "./registry"
import type { ContentTypeDef } from "./types"

/**
 * Relationship engine. Relations are stored as generic `ContentRelation` rows
 * (polymorphic `targetType` + `targetId`) so any content can link to other
 * content or domain entities (product/auction/giveaway) without dedicated join
 * tables. This module syncs edits and resolves targets for display.
 */

export interface RelationInput {
  relationKey: string
  targetType: string
  targetId: string
}

export interface ResolvedTarget {
  targetType: string
  targetId: string
  label: string
  thumb: string | null
  href: string | null
  exists: boolean
}

export type ResolvedRelations = Record<string, ResolvedTarget[]>

/** Replace a content item's relations with the provided set (diffed per slot). */
export async function syncRelations(
  fromContentId: string,
  def: ContentTypeDef,
  inputs: RelationInput[],
): Promise<void> {
  const validKeys = new Set(def.relations.map((r) => r.key))
  const clean = inputs.filter((i) => validKeys.has(i.relationKey) && i.targetId)

  // Enforce per-slot `max` where declared.
  const bySlot = new Map<string, RelationInput[]>()
  for (const i of clean) {
    const arr = bySlot.get(i.relationKey) ?? []
    arr.push(i)
    bySlot.set(i.relationKey, arr)
  }
  for (const rel of def.relations) {
    if (rel.max) {
      const arr = bySlot.get(rel.key)
      if (arr && arr.length > rel.max) bySlot.set(rel.key, arr.slice(0, rel.max))
    }
  }

  await prisma.$transaction([
    prisma.contentRelation.deleteMany({ where: { fromContentId } }),
    prisma.contentRelation.createMany({
      data: [...bySlot.entries()].flatMap(([relationKey, arr]) =>
        arr.map((i, idx) => ({
          fromContentId,
          relationKey,
          targetType: i.targetType,
          targetId: i.targetId,
          order: idx,
        })),
      ),
    }),
  ])
}

/** Load a content item's relations, grouped by slot key, with target details. */
export async function resolveRelations(fromContentId: string): Promise<ResolvedRelations> {
  const rows = await prisma.contentRelation.findMany({
    where: { fromContentId },
    orderBy: { order: "asc" },
  })
  if (rows.length === 0) return {}

  // Batch-load targets per kind.
  const contentIds = rows.filter((r) => r.targetType === "content").map((r) => r.targetId)
  const productIds = rows
    .filter((r) => r.targetType === "product" || r.targetType === "auction")
    .map((r) => r.targetId)
  const giveawayIds = rows.filter((r) => r.targetType === "giveaway").map((r) => r.targetId)

  const [contents, products, giveaways] = await Promise.all([
    contentIds.length
      ? prisma.content.findMany({
          where: { id: { in: contentIds } },
          select: { id: true, type: true, slug: true, title: true, coverImageUrl: true },
        })
      : Promise.resolve([]),
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, slug: true, title: true, coverImage: true, saleMode: true },
        })
      : Promise.resolve([]),
    giveawayIds.length
      ? prisma.giveaway.findMany({
          where: { id: { in: giveawayIds } },
          select: { id: true, slug: true, title: true, coverImage: true },
        })
      : Promise.resolve([]),
  ])

  const contentMap = new Map(contents.map((c) => [c.id, c]))
  const productMap = new Map(products.map((p) => [p.id, p]))
  const giveawayMap = new Map(giveaways.map((g) => [g.id, g]))

  const grouped: ResolvedRelations = {}
  for (const row of rows) {
    let resolved: ResolvedTarget
    if (row.targetType === "content") {
      const c = contentMap.get(row.targetId)
      resolved = {
        targetType: row.targetType,
        targetId: row.targetId,
        label: c?.title ?? "(حذف‌شده)",
        thumb: c?.coverImageUrl ?? null,
        href: c ? contentHref(c.type, c.slug) : null,
        exists: !!c,
      }
    } else if (row.targetType === "product" || row.targetType === "auction") {
      const p = productMap.get(row.targetId)
      resolved = {
        targetType: row.targetType,
        targetId: row.targetId,
        label: p?.title ?? "(حذف‌شده)",
        thumb: p?.coverImage ?? null,
        href: p ? (p.saleMode === "AUCTION" ? `/auctions/${p.id}` : `/flash/${p.id}`) : null,
        exists: !!p,
      }
    } else {
      const g = giveawayMap.get(row.targetId)
      resolved = {
        targetType: row.targetType,
        targetId: row.targetId,
        label: g?.title ?? "(حذف‌شده)",
        thumb: g?.coverImage ?? null,
        href: g ? `/giveaways/${g.slug}` : null,
        exists: !!g,
      }
    }
    ;(grouped[row.relationKey] ??= []).push(resolved)
  }
  return grouped
}

/** Compute a public href for a content item from its type's routing config. */
export function contentHref(typeKey: string, slug: string): string | null {
  const def = requireContentType(typeKey)
  if (def.routing.mode === "singleton") return def.routing.basePath
  return `${def.routing.basePath}/${slug}`
}
