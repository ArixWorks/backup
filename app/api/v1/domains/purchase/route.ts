import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { purchaseDomain } from "@/lib/core/domains/service"

const schema = z.object({
  quoteId: z.string().cuid(),
  idempotencyKey: z.string().min(16).max(100),
})

export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const body = schema.parse(await req.json())
  return purchaseDomain(user.id, body.quoteId, body.idempotencyKey)
})
