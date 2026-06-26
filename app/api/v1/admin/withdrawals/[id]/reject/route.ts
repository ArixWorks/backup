import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { rejectWithdrawal } from "@/lib/core/finance"

const schema = z.object({ reason: z.string().optional() })

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json().catch(() => ({})))
  return rejectWithdrawal(id, admin.id, body.reason)
})
