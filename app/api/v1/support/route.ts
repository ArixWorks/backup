import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { createTicket, listTickets, SUPPORT_CATEGORIES } from "@/lib/core/support"
import { rateLimitBy } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

const schema = z.object({
  subject: z.string(),
  category: z.enum(SUPPORT_CATEGORIES).optional(),
  message: z.string(),
  attachmentUrl: z.string().url().optional(),
})

export const GET = route(async () => {
  const user = await requireUser()
  return listTickets(user.id)
})

export const POST = route(async (req: Request) => {
  const user = await requireUser()
  // Throttle ticket creation to stop support-queue flooding.
  await rateLimitBy(user.id, { bucket: "support:create", limit: 10, windowSec: 600 })
  const body = schema.parse(await req.json())
  return createTicket({
    userId: user.id,
    subject: body.subject,
    category: body.category,
    message: body.message,
    attachmentUrl: body.attachmentUrl,
  })
})
