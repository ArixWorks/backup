import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import {
  getProductAdmin,
  updateFlashProduct,
  setProductVisibility,
  updateProductMedia,
} from "@/lib/core/admin-catalog"
import { richTextField } from "@/lib/rich-content/zod"

export const dynamic = "force-dynamic"

const money = z.union([z.string(), z.number()])

const linkSchema = z.object({ label: z.string(), url: z.string() })

const schema = z.object({
  title: z.string().optional(),
  description: richTextField().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  i18n: z.record(z.string(), z.unknown()).nullable().optional(),
  coverImage: z.string().optional(),
  gallery: z.array(z.string()).optional(),
  price: money.optional(),
  stock: z.number().int().min(0).optional(),
  purchaseLimit: z.number().int().positive().nullable().optional(),
  links: z.array(linkSchema).optional(),
  soldBaseline: z.number().int().min(0).optional(),
  bulkMinQty: z.number().int().positive().nullable().optional(),
  bulkDiscountPercent: z.number().int().min(1).max(90).nullable().optional(),
  hidden: z.boolean().optional(),
  active: z.boolean().optional(),
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

  if (typeof body.hidden === "boolean" && Object.keys(body).length === 1) {
    await setProductVisibility(id, body.hidden, admin.id)
    return { ok: true }
  }

  // Media-only updates (cover/gallery) work for any product, including auctions.
  const keys = Object.keys(body)
  if (keys.length > 0 && keys.every((k) => k === "coverImage" || k === "gallery")) {
    return updateProductMedia(id, { coverImage: body.coverImage, gallery: body.gallery }, admin.id)
  }

  return updateFlashProduct(
    id,
    {
      title: body.title,
      description: body.description,
      category: body.category,
      tags: body.tags,
      gallery: body.gallery,
      i18n: (body.i18n ?? undefined) as never,
      coverImage: body.coverImage,
      price: body.price != null ? BigInt(body.price) : undefined,
      stock: body.stock,
      purchaseLimit: body.purchaseLimit,
      links: body.links,
      soldBaseline: body.soldBaseline,
      bulkMinQty: body.bulkMinQty,
      bulkDiscountPercent: body.bulkDiscountPercent,
      hidden: body.hidden,
      active: body.active,
    },
    admin.id,
  )
})
