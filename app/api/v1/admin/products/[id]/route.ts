import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import {
  getProductAdmin,
  updateFlashProduct,
  setProductVisibility,
  setProductDefaultTutorial,
  updateProductMedia,
  updateProductHighlights,
  deleteProducts,
} from "@/lib/core/admin-catalog"
import { ValidationError } from "@/lib/core/errors"
import { richTextField } from "@/lib/rich-content/zod"
import { requireTestCleanupOwner } from "@/lib/core/admin/test-cleanup"
import { deliveryTemplateSchema } from "@/lib/core/delivery-fields"
import { assertCategory } from "@/lib/core/product-categories"

export const dynamic = "force-dynamic"

const money = z.union([z.string(), z.number()])

const linkSchema = z.object({ label: z.string(), url: z.string() })

const schema = z.object({
  title: z.string().optional(),
  subtitle: z.string().max(160).nullable().optional(),
  description: richTextField().optional(),
  category: z.string().optional(),
  categoryId: z.string().cuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  highlights: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
  i18n: z.record(z.string(), z.unknown()).nullable().optional(),
  coverImage: z.string().optional(),
  gallery: z.array(z.string()).optional(),
  price: money.optional(),
  compareAtPrice: money.nullable().optional(),
  stock: z.number().int().min(0).optional(),
  purchaseLimit: z.number().int().positive().nullable().optional(),
  links: z.array(linkSchema).optional(),
  soldBaseline: z.number().int().min(0).optional(),
  bulkMinQty: z.number().int().positive().nullable().optional(),
  bulkDiscountPercent: z.number().int().min(1).max(90).nullable().optional(),
  hidden: z.boolean().optional(),
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
  featuredOrder: z.number().int().min(0).max(9999).optional(),
  defaultTutorialId: z.string().cuid().nullable().optional(),
  deliveryFields: deliveryTemplateSchema.nullable().optional(),
})

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  return getProductAdmin(id)
})

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())
  await assertCategory(body.categoryId)

  if (typeof body.hidden === "boolean" && Object.keys(body).length === 1) {
    await setProductVisibility(id, body.hidden, admin.id)
    return { ok: true }
  }

  if (body.defaultTutorialId !== undefined && Object.keys(body).length === 1) {
    return setProductDefaultTutorial(id, body.defaultTutorialId, admin.id)
  }

  // Media-only updates (cover/gallery) work for any product, including auctions.
  const keys = Object.keys(body)
  if (keys.length > 0 && keys.every((k) => k === "coverImage" || k === "gallery")) {
    return updateProductMedia(id, { coverImage: body.coverImage, gallery: body.gallery }, admin.id)
  }

  // Highlights-only updates work for any product (fixed-price AND auctions),
  // so they don't require a FixedSale the way updateFlashProduct does.
  if (body.highlights !== undefined && keys.length === 1) {
    return updateProductHighlights(id, body.highlights, admin.id)
  }

  return updateFlashProduct(
    id,
    {
      title: body.title,
      subtitle: body.subtitle,
      description: body.description,
      category: body.category,
      categoryId: body.categoryId,
      tags: body.tags,
      gallery: body.gallery,
      i18n: (body.i18n ?? undefined) as never,
      coverImage: body.coverImage,
      price: body.price != null ? BigInt(body.price) : undefined,
      compareAtPrice:
        body.compareAtPrice === undefined ? undefined : body.compareAtPrice === null ? null : BigInt(body.compareAtPrice),
      stock: body.stock,
      purchaseLimit: body.purchaseLimit,
      links: body.links,
      soldBaseline: body.soldBaseline,
      bulkMinQty: body.bulkMinQty,
      bulkDiscountPercent: body.bulkDiscountPercent,
      hidden: body.hidden,
      active: body.active,
      featured: body.featured,
      featuredOrder: body.featuredOrder,
      deliveryFields: body.deliveryFields,
    },
    admin.id,
  )
})

export const DELETE = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  let reversePurchases = false
  try {
    const body = await req.json()
    reversePurchases = body?.reversePurchases === true
  } catch {}
  const admin = reversePurchases ? await requireTestCleanupOwner() : await requireAdmin()
  const { id } = await ctx.params
  const result = await deleteProducts([id], admin.id, { reversePurchases })
  // Single-target delete: surface the guard reason as a clear error.
  if (result.deleted.length === 0) {
    const reason = result.skipped[0]?.reason ?? "حذف ممکن نشد"
    throw new ValidationError(reason)
  }
  return result
})
