import { route } from "@/lib/api/handler"
import { getFlashDetail } from "@/lib/core/catalog"
import { NotFoundError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request, ctx: { params: Promise<{ productId: string }> }) => {
  const { productId } = await ctx.params
  const locale = new URL(req.url).searchParams.get("locale") ?? "fa"
  const detail = await getFlashDetail(productId, locale)
  if (!detail) throw new NotFoundError("Product not found")
  return detail
})
