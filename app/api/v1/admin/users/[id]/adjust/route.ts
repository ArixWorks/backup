import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { adjustBalance } from "@/lib/core/admin"

const schema = z.object({
  amount: z.union([z.string(), z.number()]),
  reason: z.string().min(1, "دلیل الزامی است"),
})

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())
  return adjustBalance(id, BigInt(body.amount), body.reason, admin.id)
})
