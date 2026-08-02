import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { submitCustomerInput } from "@/lib/core/order-lifecycle"

// The buyer submits their account info for a customer-input order. Values are a
// free-form key→string map; the service validates them against the order's
// snapshotted field template (required/type) before storing.
const schema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
})

export const POST = route(async (req: Request, ctx: { params: Promise<{ publicId: string }> }) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  const { values } = schema.parse(await req.json())
  await submitCustomerInput(publicId, user.id, values)
  return { ok: true }
})
