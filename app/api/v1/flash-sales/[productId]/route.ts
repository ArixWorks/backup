import { route } from "@/lib/api/handler"
import { getFlashDetail } from "@/lib/core/catalog"
import { NotFoundError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"

export const GET = route(async (_req: Request, ctx: { params: Promise<{ productId: string }> }) => {
  const { productId } = await ctx.params
  const detail = await getFlashDetail(productId)
  if (!detail) throw new NotFoundError("Product not found")
  return detail
})
