import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listDomainOrdersForUser, listShopOrdersForUser } from "@/lib/core/order-views"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const user = await requireUser()
  // Unify shop/auction orders (Order table) with domain orders (DomainOrder
  // table) into a single feed; the client buckets them by `category`.
  const [shop, domains] = await Promise.all([
    listShopOrdersForUser(user.id),
    listDomainOrdersForUser(user.id),
  ])
  const merged = [...shop, ...domains].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
  return merged
})
