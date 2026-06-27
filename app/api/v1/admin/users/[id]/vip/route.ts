import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { grantVip, revokeVip } from "@/lib/core/gamification"

// Grant or revoke the exclusive, admin-only VIP membership for a user.
// `durationDays` is optional; when omitted (or 0) the grant never expires.
const schema = z.object({
  action: z.enum(["grant", "revoke"]),
  durationDays: z.coerce.number().int().min(0).max(3650).optional(),
})

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())

  if (body.action === "revoke") {
    await revokeVip(id)
    return { ok: true, vip: false }
  }

  const expiresAt =
    body.durationDays && body.durationDays > 0
      ? new Date(Date.now() + body.durationDays * 86_400_000)
      : null
  await grantVip(id, expiresAt)
  return { ok: true, vip: true, expiresAt }
})
