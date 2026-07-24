import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { failStarsDeposit } from "@/lib/core/finance"

export const dynamic = "force-dynamic"

const schema = z.object({
  id: z.string().min(1),
})

/**
 * Mark a Stars top-up as failed when the Mini App reports the invoice was
 * cancelled or errored (the user closed the payment sheet without paying).
 * This keeps the request from lingering as a phantom "pending" entry. Credit
 * only ever happens through the `successful_payment` webhook, so this is safe:
 * an already-paid request is left untouched.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const { id } = schema.parse(await req.json())
  const updated = await failStarsDeposit(id, user.id)
  return { id: updated.id, status: updated.status }
})
