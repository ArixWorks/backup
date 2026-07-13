import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { reviewFinding } from "@/lib/ai/text-integrity"

const schema = z.object({ decision: z.enum(["approve", "reject"]) })

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  await rateLimitBy(admin.id, { bucket: "text-integrity:review", limit: 60, windowSec: 60 })
  const { id } = await ctx.params
  const { decision } = schema.parse(await req.json())
  return reviewFinding(id, decision, admin.id)
})
