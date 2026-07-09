import { z } from "zod"
import { uploadedFileUrl } from "@/lib/api/file-url"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { claimDepositPaid } from "@/lib/core/finance"
import { rateLimitBy } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

const schema = z.object({
  receiptUrl: uploadedFileUrl.optional(),
  // `paid: true` is the final "I've paid" confirmation that submits the request
  // to the admin. A receipt upload alone (without `paid`) keeps it as a draft.
  paid: z.boolean().optional(),
})

/** User marks a deposit as paid and/or attaches a receipt screenshot. */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())
  await rateLimitBy(user.id, { bucket: "wallet:deposit:claim", limit: 30, windowSec: 600 })
  return claimDepositPaid(id, user.id, body.receiptUrl, body.paid === true)
})
