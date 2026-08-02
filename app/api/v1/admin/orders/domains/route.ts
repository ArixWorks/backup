import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listDomainOrdersForAdmin } from "@/lib/core/order-views"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const scope = url.searchParams.get("scope") === "all" ? "all" : "active"
  const q = url.searchParams.get("q") ?? undefined
  const items = await listDomainOrdersForAdmin({ scope, q })
  return { items }
})
