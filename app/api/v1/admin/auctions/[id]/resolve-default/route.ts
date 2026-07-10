import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { handleWinnerDefault } from "@/lib/core/auction"

// Admin: immediately apply the configured winner-default action to a
// PAYMENT_PENDING auction whose deadline has passed, instead of waiting for the
// next cron tick. Reuses the exact same lifecycle path as the cron processor.
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  return handleWinnerDefault(id)
})
