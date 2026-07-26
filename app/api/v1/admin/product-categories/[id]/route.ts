import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { deleteProductCategory, updateProductCategory } from "@/lib/core/product-categories"

const schema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "شناسه باید انگلیسی و خط‌تیره‌دار باشد").optional(),
  description: z.string().trim().max(240).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
})

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  return updateProductCategory(id, schema.parse(await req.json()), admin.id)
})

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  return deleteProductCategory(id, admin.id)
})
