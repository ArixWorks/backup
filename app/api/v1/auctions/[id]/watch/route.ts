import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { addToWatchlist, isWatching, removeFromWatchlist } from "@/lib/core/watchlist"

export const dynamic = "force-dynamic"

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params
  return { watching: await isWatching(user.id, id) }
})

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params
  return addToWatchlist(user.id, id)
})

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params
  return removeFromWatchlist(user.id, id)
})
