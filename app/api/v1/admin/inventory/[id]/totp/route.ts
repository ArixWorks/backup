import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { setInventoryTotpSecret, removeInventoryTotpSecret } from "@/lib/core/totp-service"

const schema = z.object({
  secret: z.string().trim().min(1),
  // null / omitted = unlimited fetches for each recipient.
  maxUses: z.coerce.number().int().min(1).max(1000).nullable().optional(),
  digits: z.coerce.number().int().min(6).max(8).optional(),
  period: z.coerce.number().int().min(15).max(120).optional(),
  algo: z.enum(["SHA1", "SHA256", "SHA512"]).optional(),
})

// PUT: attach or replace the on-demand 2FA secret on an inventory credential.
export const PUT = route(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireAdmin()
    const { id } = await ctx.params
    const body = schema.parse(await req.json())
    const s = await setInventoryTotpSecret(id, body.secret, {
      maxUses: body.maxUses ?? null,
      digits: body.digits,
      period: body.period,
      algo: body.algo,
    })
    return { id: s.id, maxUses: s.maxUses, digits: s.digits, period: s.period }
  },
)

// DELETE: remove the 2FA secret from an inventory credential.
export const DELETE = route(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireAdmin()
    const { id } = await ctx.params
    await removeInventoryTotpSecret(id)
    return { ok: true }
  },
)
