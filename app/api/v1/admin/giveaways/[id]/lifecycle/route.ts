import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { setGiveawayLifecycle } from "@/lib/core/giveaway"

export const dynamic = "force-dynamic"

const Body = z.object({
  action: z.enum(["publish", "pause", "resume", "cancel", "delay", "adjust"]),
  // delay: positive minutes to push the draw back by (default 30).
  // adjust: signed minutes (positive = extend, negative = shorten) applied to
  //         either the registration window or the draw time.
  minutes: z.number().int().min(-10080).max(10080).optional(),
  target: z.enum(["registration", "draw"]).optional(),
})

// Lifecycle transitions: publish / pause / resume / cancel / delay-draw / adjust.
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await params
  const body = Body.parse(await req.json())
  return setGiveawayLifecycle(id, body.action, {
    actorId: admin.id,
    minutes: body.minutes,
    target: body.target,
  })
})
