import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listVariants, createVariant, reorderVariants } from "@/lib/core/variants"

export const dynamic = "force-dynamic"

const money = z.union([z.string(), z.number()])

const attributesSchema = z.record(z.string(), z.unknown()).nullable().optional()

const createSchema = z.object({
  name: z.string().min(1),
  attributes: attributesSchema,
  description: z.string().nullable().optional(),
  i18n: z.record(z.string(), z.unknown()).nullable().optional(),
  price: money,
  compareAtPrice: money.nullable().optional(),
  stock: z.number().int().min(0).optional(),
  purchaseLimit: z.number().int().positive().nullable().optional(),
  deliveryType: z.enum(["MANUAL", "AUTOMATIC"]).optional(),
  displayOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})

const reorderSchema = z.object({ order: z.array(z.string()).min(1) })

const bodySchema = z.union([createSchema, reorderSchema])

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  return listVariants(id)
})

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = bodySchema.parse(await req.json())

  // Reorder payload: { order: [...] }
  if ("order" in body) {
    return reorderVariants(id, body.order, admin.id)
  }

  return createVariant(
    id,
    {
      name: body.name,
      attributes: body.attributes as never,
      description: body.description,
      i18n: body.i18n,
      price: BigInt(body.price),
      compareAtPrice: body.compareAtPrice != null ? BigInt(body.compareAtPrice) : null,
      stock: body.stock,
      purchaseLimit: body.purchaseLimit,
      deliveryType: body.deliveryType,
      displayOrder: body.displayOrder,
      active: body.active,
    },
    admin.id,
  )
})
