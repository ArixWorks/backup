import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listUserDomainOrders, listUserOwnedDomains } from "@/lib/core/domains/service"

export const GET = route(async () => {
  const user = await requireUser()
  const [orders, domains] = await Promise.all([
    listUserDomainOrders(user.id),
    listUserOwnedDomains(user.id),
  ])
  return { orders, domains }
})
