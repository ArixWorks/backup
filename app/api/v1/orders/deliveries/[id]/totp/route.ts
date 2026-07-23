import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { getTotpStatus, issueTotpCode } from "@/lib/core/totp-service"

export const dynamic = "force-dynamic"

// GET: current allowance/status for this delivery's 2FA (null if none attached).
export const GET = route(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser()
    const { id } = await ctx.params
    return getTotpStatus({ kind: "delivery", deliveryId: id }, user.id)
  },
)

// POST: issue a fresh code, consuming one use from the recipient's allowance.
export const POST = route(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser()
    const { id } = await ctx.params
    return issueTotpCode({ kind: "delivery", deliveryId: id }, user.id)
  },
)
