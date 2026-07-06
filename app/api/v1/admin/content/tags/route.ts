import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listTags } from "@/lib/cms/taxonomy"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return { items: await listTags() }
})
