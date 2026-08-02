import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listShopOrdersForAdmin } from "@/lib/core/order-views"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const scope = new URL(req.url).searchParams.get("scope") === "all" ? "all" : "active"
  const orders = await listShopOrdersForAdmin(scope)
  return { orders }
})
