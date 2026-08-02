import { route } from "@/lib/api/handler"
import { NotFoundError } from "@/lib/core/errors"
import { requireAdmin } from "@/lib/auth/session"
import { getDomainOrderForAdmin } from "@/lib/core/order-views"

export const dynamic = "force-dynamic"

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const order = await getDomainOrderForAdmin(id)
  if (!order) throw new NotFoundError("سفارش دامنه یافت نشد.")
  // Return the detail directly (handler wraps in { data }) to match the shop
  // detail route, so the client reads data.data as the order object.
  return order
})
