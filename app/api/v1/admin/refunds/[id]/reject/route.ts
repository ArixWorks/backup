import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { rejectRefund } from "@/lib/core/refunds"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const schema = z.object({ reason: z.string().optional() })

export const POST = route(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json().catch(() => ({})))
  return rejectRefund(id, admin.id, body.reason)
})
