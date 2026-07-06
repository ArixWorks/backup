import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { updateCategory, deleteCategory } from "@/lib/cms/taxonomy"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().max(120).optional(),
  parentId: z.string().trim().nullish(),
  order: z.number().int().min(0).max(100000).optional(),
})

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  await requireAdmin()
  const { id } = await ctx.params
  const input = patchSchema.parse(await req.json())
  return updateCategory(id, input)
})

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  await requireAdmin()
  const { id } = await ctx.params
  await deleteCategory(id)
  return { ok: true }
})
