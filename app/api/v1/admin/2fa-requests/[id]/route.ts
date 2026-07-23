import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { approveReRequest, rejectReRequest } from "@/lib/core/totp-service"

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    grantedUses: z.coerce.number().int().min(1).max(1000),
    message: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal("reject"),
    message: z.string().trim().max(500).optional(),
  }),
])

// PATCH: approve (grant bonus fetches) or reject a 2FA re-request.
export const PATCH = route(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireAdmin()
    const { id } = await ctx.params
    const body = schema.parse(await req.json())
    const rr =
      body.action === "approve"
        ? await approveReRequest(id, body.grantedUses, body.message)
        : await rejectReRequest(id, body.message)
    return { id: rr.id, status: rr.status }
  },
)
