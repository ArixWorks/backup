import { z } from "zod"
import { route } from "@/lib/api/handler"
import { currentUserId, requireUser } from "@/lib/auth/session"
import {
  listReviews,
  getReviewSummary,
  upsertReview,
  canReview,
  getMyReview,
  deleteMyReview,
} from "@/lib/core/reviews"

// Public: list reviews + summary, flagging the viewer's own review if signed in.
export const GET = route(
  async (_req: Request, ctx: { params: Promise<{ productId: string }> }) => {
    const { productId } = await ctx.params
    const viewerId = (await currentUserId()) ?? undefined
    const [summary, reviews, eligible, mine] = await Promise.all([
      getReviewSummary(productId),
      listReviews(productId, viewerId),
      viewerId ? canReview(viewerId, productId) : Promise.resolve(false),
      viewerId ? getMyReview(viewerId, productId) : Promise.resolve(null),
    ])
    return { summary, reviews, eligible, mine }
  },
)

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

// Authenticated: create or update the caller's review (purchase-gated).
export const POST = route(
  async (req: Request, ctx: { params: Promise<{ productId: string }> }) => {
    const user = await requireUser()
    const { productId } = await ctx.params
    const body = schema.parse(await req.json().catch(() => ({})))
    return upsertReview(user.id, productId, body.rating, body.comment)
  },
)

// Authenticated: remove the caller's own review.
export const DELETE = route(
  async (_req: Request, ctx: { params: Promise<{ productId: string }> }) => {
    const user = await requireUser()
    const { productId } = await ctx.params
    return deleteMyReview(user.id, productId)
  },
)
