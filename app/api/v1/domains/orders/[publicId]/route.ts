import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { NotFoundError } from "@/lib/core/errors"
import { getDomainOrderForUser } from "@/lib/core/order-views"

export const dynamic = "force-dynamic"

export const GET = route(async (_req: Request, ctx: { params: Promise<{ publicId: string }> }) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  const order = await getDomainOrderForUser(publicId, user.id)
  if (!order) throw new NotFoundError("سفارش دامنه یافت نشد")
  return order
})
