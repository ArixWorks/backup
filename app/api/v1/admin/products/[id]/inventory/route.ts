import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listInventory, addInventoryItems } from "@/lib/core/admin"

export const dynamic = "force-dynamic"

const schema = z.object({
  variantId: z.string().trim().min(1).optional(),
  items: z
    .array(
      z.object({
        username: z.string().optional(),
        password: z.string().optional(),
        licenseKey: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .min(1),
})

export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  // Optional ?variantId= scopes the pool to one sale plan.
  const variantId = new URL(req.url).searchParams.get("variantId")
  return listInventory(id, variantId)
})

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())
  return addInventoryItems(id, body.items, admin.id, body.variantId)
})
