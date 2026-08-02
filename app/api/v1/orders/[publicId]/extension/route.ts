import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { approveExtension } from "@/lib/core/order-lifecycle"

// The buyer accepts the admin's requested extra time ("بله"). The service adds
// the pending minutes to dueAt and returns the order to PROCESSING.
export const POST = route(async (_req: Request, ctx: { params: Promise<{ publicId: string }> }) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  await approveExtension(publicId, user.id)
  return { ok: true }
})
