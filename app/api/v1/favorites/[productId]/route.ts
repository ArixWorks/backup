import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { addFavorite, removeFavorite, isFavorited, countFavorites } from "@/lib/core/favorites"

export const dynamic = "force-dynamic"

export const GET = route(async (_req: Request, ctx: { params: Promise<{ productId: string }> }) => {
  const user = await requireUser()
  const { productId } = await ctx.params
  const [favorited, count] = await Promise.all([
    isFavorited(user.id, productId),
    countFavorites(productId),
  ])
  return { favorited, count }
})

export const POST = route(async (_req: Request, ctx: { params: Promise<{ productId: string }> }) => {
  const user = await requireUser()
  const { productId } = await ctx.params
  const res = await addFavorite(user.id, productId)
  return { ...res, count: await countFavorites(productId) }
})

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ productId: string }> }) => {
  const user = await requireUser()
  const { productId } = await ctx.params
  const res = await removeFavorite(user.id, productId)
  return { ...res, count: await countFavorites(productId) }
})
