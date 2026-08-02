import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { NotFoundError } from "@/lib/core/errors"
import { getShopOrderDetailForAdmin } from "@/lib/core/order-views"

export const dynamic = "force-dynamic"

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const order = await getShopOrderDetailForAdmin(id)
  if (!order) throw new NotFoundError("سفارش یافت نشد")
  return order
})
