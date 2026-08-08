import { z } from "@/lib/zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getOfferAdmin, updateOffer, setOfferActive } from "@/lib/core/vps/catalog"
import { vpsOfferUpdateSchema, toOfferInput } from "@/lib/core/vps/schema"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const GET = route(async (_req: Request, ctx: Ctx) => {
  await requireAdmin()
  const { id } = await ctx.params
  return getOfferAdmin(id)
})

// A dedicated toggle payload keeps "activate/deactivate" one round-trip away
// without shipping the whole offer body.
const patchSchema = z.union([
  z.object({ action: z.literal("setActive"), active: z.boolean() }),
  vpsOfferUpdateSchema,
])

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  await requireAdmin()
  const { id } = await ctx.params
  const body = patchSchema.parse(await req.json())
  if ("action" in body && body.action === "setActive") {
    return setOfferActive(id, body.active)
  }
  return updateOffer(id, toOfferInput(body) as never)
})
