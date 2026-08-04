import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listNsRequestsForAdmin } from "@/lib/core/order-views"

export const dynamic = "force-dynamic"

// Admin work queue of nameserver change requests, filterable by status scope.
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const scopeParam = url.searchParams.get("scope")
  const scope =
    scopeParam === "completed" || scopeParam === "rejected" || scopeParam === "all" ? scopeParam : "pending"
  const q = url.searchParams.get("q") ?? undefined
  const items = await listNsRequestsForAdmin({ scope, q })
  return { items }
})
