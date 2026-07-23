import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { getTotpStatus, issueTotpCode } from "@/lib/core/totp-service"

export const dynamic = "force-dynamic"

// GET: current 2FA allowance/status for this win (null if none attached).
export const GET = route(async (_req: Request, ctx: { params: Promise<{ winnerId: string }> }) => {
  const user = await requireUser()
  const { winnerId } = await ctx.params
  return getTotpStatus({ kind: "winner", winnerId }, user.id)
})

// POST: issue a fresh code, consuming one use from the winner's allowance.
export const POST = route(async (_req: Request, ctx: { params: Promise<{ winnerId: string }> }) => {
  const user = await requireUser()
  const { winnerId } = await ctx.params
  return issueTotpCode({ kind: "winner", winnerId }, user.id)
})
