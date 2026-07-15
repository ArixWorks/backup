import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { lookupDomainCatalog } from "@/lib/core/domains/service"

const schema = z.object({ domain: z.string().trim().min(1, "نام دامنه را وارد کنید.").max(253) })

export const POST = route(async (req: Request) => {
  await requireUser()
  const { domain } = schema.parse(await req.json())
  return lookupDomainCatalog(domain)
})
