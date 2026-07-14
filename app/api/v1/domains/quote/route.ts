import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { createDomainQuote } from "@/lib/core/domains/service"

const schema = z.object({ domain: z.string().trim().min(3).max(253) })

export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const { domain } = schema.parse(await req.json())
  return createDomainQuote(user.id, domain)
})
