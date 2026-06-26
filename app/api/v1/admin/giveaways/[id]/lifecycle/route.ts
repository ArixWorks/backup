import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { setGiveawayLifecycle } from "@/lib/core/giveaway"

export const dynamic = "force-dynamic"

const Body = z.object({
  action: z.enum(["publish", "pause", "resume", "cancel", "delay"]),
  // delay: minutes to push the draw back by (default 30).
  minutes: z.number().int().positive().max(10080).optional(),
})

// Lifecycle transitions: publish / pause / resume / cancel / delay-draw.
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await params
  const body = Body.parse(await req.json())
  return setGiveawayLifecycle(id, body.action, { actorId: admin.id, minutes: body.minutes })
})
