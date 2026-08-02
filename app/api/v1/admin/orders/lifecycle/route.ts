import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listShopOrdersForAdmin } from "@/lib/core/order-views"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const params = new URL(req.url).searchParams
  const scope = params.get("scope") === "all" ? "all" : "active"
  const q = params.get("q") ?? undefined
  const categoryParam = params.get("category")
  const category = categoryParam === "SHOP" || categoryParam === "AUCTION" ? categoryParam : undefined
  const orders = await listShopOrdersForAdmin({ scope, q, category })
  return { orders }
})
