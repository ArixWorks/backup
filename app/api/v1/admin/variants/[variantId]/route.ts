import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { updateVariant, deleteVariant } from "@/lib/core/variants"

export const dynamic = "force-dynamic"

const money = z.union([z.string(), z.number()])

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  attributes: z.record(z.string(), z.unknown()).nullable().optional(),
  description: z.string().nullable().optional(),
  i18n: z.record(z.string(), z.unknown()).nullable().optional(),
  price: money.optional(),
  compareAtPrice: money.nullable().optional(),
  stock: z.number().int().min(0).optional(),
  purchaseLimit: z.number().int().positive().nullable().optional(),
  deliveryType: z.enum(["MANUAL", "AUTOMATIC"]).optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ variantId: string }> }) => {
  const admin = await requireAdmin()
  const { variantId } = await ctx.params
  const body = patchSchema.parse(await req.json())
  return updateVariant(
    variantId,
    {
      name: body.name,
      attributes: body.attributes as never,
      description: body.description,
      i18n: body.i18n,
      price: body.price != null ? BigInt(body.price) : undefined,
      compareAtPrice:
        body.compareAtPrice !== undefined ? (body.compareAtPrice != null ? BigInt(body.compareAtPrice) : null) : undefined,
      stock: body.stock,
      purchaseLimit: body.purchaseLimit,
      deliveryType: body.deliveryType,
      displayOrder: body.displayOrder,
      active: body.active,
    },
    admin.id,
  )
})

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ variantId: string }> }) => {
  const admin = await requireAdmin()
  const { variantId } = await ctx.params
  return deleteVariant(variantId, admin.id)
})
