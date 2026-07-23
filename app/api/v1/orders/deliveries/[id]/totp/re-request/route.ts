import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { createReRequest } from "@/lib/core/totp-service"

const schema = z.object({ reason: z.string().trim().min(3).max(500) })

// POST: open a re-request for more 2FA fetches once the allowance is used up.
export const POST = route(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser()
    const { id } = await ctx.params
    const { reason } = schema.parse(await req.json())
    const rr = await createReRequest({ kind: "delivery", deliveryId: id }, user.id, reason)
    return { id: rr.id, status: rr.status }
  },
)
