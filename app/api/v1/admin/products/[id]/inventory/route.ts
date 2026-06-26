import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listInventory, addInventoryItems } from "@/lib/core/admin"

export const dynamic = "force-dynamic"

const schema = z.object({
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

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  return listInventory(id)
})

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())
  return addInventoryItems(id, body.items, admin.id)
})
