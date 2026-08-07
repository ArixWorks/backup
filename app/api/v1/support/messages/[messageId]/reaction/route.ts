import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { REACTION_TYPES, setReaction } from "@/lib/core/support"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ messageId: string }> }

const schema = z.object({ type: z.enum(REACTION_TYPES) })

/**
 * Toggle an emoji reaction on a ticket message. Works for both the ticket owner
 * and admins — the core layer authorizes based on role and thread ownership,
 * so users can only react inside their own threads.
 */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser()
  const { messageId } = await ctx.params
  const body = schema.parse(await req.json())
  const reactions = await setReaction({
    userId: user.id,
    isAdmin: user.role === "ADMIN",
    messageId,
    type: body.type,
  })
  return { reactions }
})
