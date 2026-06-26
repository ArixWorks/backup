import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listOrders } from "@/lib/core/admin"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const status = new URL(req.url).searchParams.get("status")
  return listOrders(status ?? undefined)
})
