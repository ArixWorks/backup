import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { watchProduct, unwatchProduct, isWatchingProduct } from "@/lib/core/stock-alerts"

export const dynamic = "force-dynamic"

export const GET = route(async (_req: Request, ctx: { params: Promise<{ productId: string }> }) => {
  const user = await requireUser()
  const { productId } = await ctx.params
  const watching = await isWatchingProduct(user.id, productId)
  return { watching }
})

export const POST = route(async (_req: Request, ctx: { params: Promise<{ productId: string }> }) => {
  const user = await requireUser()
  const { productId } = await ctx.params
  return watchProduct(user.id, productId)
})

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ productId: string }> }) => {
  const user = await requireUser()
  const { productId } = await ctx.params
  return unwatchProduct(user.id, productId)
})
