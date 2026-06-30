import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { claimDepositPaid } from "@/lib/core/finance"
import { rateLimitBy } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

const schema = z.object({
  receiptUrl: z.string().url().optional(),
})

/** User marks a deposit as paid and/or attaches a receipt screenshot. */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())
  await rateLimitBy(user.id, { bucket: "wallet:deposit:claim", limit: 30, windowSec: 600 })
  return claimDepositPaid(id, user.id, body.receiptUrl)
})
