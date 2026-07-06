import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { ValidationError } from "@/lib/core/errors"
import { prisma } from "@/lib/db"
import { parseRelationTarget } from "@/lib/cms/registry"
import type { RelationTargetType } from "@/lib/cms/types"

export const dynamic = "force-dynamic"

export interface RelationOption {
  targetType: string
  targetId: string
  label: string
  thumb: string | null
  meta?: string
}

/** Async search feeding the admin Relation Picker for a given target type. */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const rawTarget = url.searchParams.get("targetType")
  const q = (url.searchParams.get("q") ?? "").trim()
  if (!rawTarget) throw new ValidationError("نوع هدف الزامی است")

  const { kind, contentTypeKey } = parseRelationTarget(rawTarget as RelationTargetType)

  if (kind === "content") {
    const items = await prisma.content.findMany({
      where: {
        ...(contentTypeKey ? { type: contentTypeKey } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, title: true, coverImageUrl: true, status: true },
    })
    return {
      items: items.map<RelationOption>((c) => ({
        targetType: "content",
        targetId: c.id,
        label: c.title,
        thumb: c.coverImageUrl,
        meta: c.status,
      })),
    }
  }

  if (kind === "product" || kind === "auction") {
    const items = await prisma.product.findMany({
      where: {
        saleMode: kind === "auction" ? "AUCTION" : "FIXED_PRICE",
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, coverImage: true },
    })
    return {
      items: items.map<RelationOption>((p) => ({
        targetType: kind,
        targetId: p.id,
        label: p.title,
        thumb: p.coverImage,
      })),
    }
  }

  // giveaway
  const items = await prisma.giveaway.findMany({
    where: q ? { title: { contains: q, mode: "insensitive" } } : {},
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, title: true, coverImage: true, status: true },
  })
  return {
    items: items.map<RelationOption>((g) => ({
      targetType: "giveaway",
      targetId: g.id,
      label: g.title,
      thumb: g.coverImage,
      meta: g.status,
    })),
  }
})
