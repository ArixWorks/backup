import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { setWinnerTotpSecret, removeWinnerTotpSecret } from "@/lib/core/totp-service"
import { NotFoundError } from "@/lib/core/errors"

const schema = z.object({
  secret: z.string().trim().min(1),
  // null / omitted = unlimited fetches for this winner.
  maxUses: z.coerce.number().int().min(1).max(1000).nullable().optional(),
  digits: z.coerce.number().int().min(6).max(8).optional(),
  period: z.coerce.number().int().min(15).max(120).optional(),
  algo: z.enum(["SHA1", "SHA256", "SHA512"]).optional(),
})

/** Guard that the winner belongs to the giveaway named in the path. */
async function assertWinner(giveawayId: string, winnerId: string) {
  const w = await prisma.giveawayWinner.findFirst({
    where: { id: winnerId, giveawayId },
    select: { id: true },
  })
  if (!w) throw new NotFoundError("برنده برای این قرعه‌کشی یافت نشد")
}

// PUT: attach or replace the on-demand 2FA secret for a giveaway winner.
export const PUT = route(
  async (req: Request, ctx: { params: Promise<{ id: string; winnerId: string }> }) => {
    await requireAdmin()
    const { id, winnerId } = await ctx.params
    await assertWinner(id, winnerId)
    const body = schema.parse(await req.json())
    const s = await setWinnerTotpSecret(winnerId, body.secret, {
      maxUses: body.maxUses ?? null,
      digits: body.digits,
      period: body.period,
      algo: body.algo,
    })
    return { id: s.id, maxUses: s.maxUses, digits: s.digits, period: s.period }
  },
)

// DELETE: remove the winner's 2FA secret.
export const DELETE = route(
  async (_req: Request, ctx: { params: Promise<{ id: string; winnerId: string }> }) => {
    await requireAdmin()
    const { id, winnerId } = await ctx.params
    await assertWinner(id, winnerId)
    await removeWinnerTotpSecret(winnerId)
    return { ok: true }
  },
)
