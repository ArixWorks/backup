import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { markMessageReadByStaff } from "@/lib/core/support"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ messageId: string }> }

/**
 * Admin manually marks a single user message as read (deliberate two-tick
 * receipt). Unlike the user side this is never automatic — the admin decides
 * when to reveal that the message was seen.
 */
export const POST = route(async (_req: Request, ctx: Ctx) => {
  await requireAdmin()
  const { messageId } = await ctx.params
  const message = await markMessageReadByStaff(messageId)
  return { id: message.id, readAt: message.readAt }
})
