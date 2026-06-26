import { route } from "@/lib/api/handler"
import { followCategory, unfollowCategory, isFollowingCategory } from "@/lib/core/category-follows"

export const dynamic = "force-dynamic"

export const GET = route(async (_req: Request, ctx: { params: Promise<{ category: string }> }) => {
  const { category } = await ctx.params
  const following = await isFollowingCategory(decodeURIComponent(category))
  return { following }
})

export const POST = route(async (_req: Request, ctx: { params: Promise<{ category: string }> }) => {
  const { category } = await ctx.params
  return followCategory(decodeURIComponent(category))
})

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ category: string }> }) => {
  const { category } = await ctx.params
  return unfollowCategory(decodeURIComponent(category))
})
