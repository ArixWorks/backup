import { prisma } from "@/lib/db"
import { NotFoundError, ValidationError, ForbiddenError } from "./errors"

export interface ReviewView {
  id: string
  rating: number
  comment: string | null
  authorName: string
  createdAt: Date
  mine: boolean
}

export interface ReviewSummary {
  average: number | null
  count: number
  /** Count of reviews per star (index 0 = 1 star … index 4 = 5 stars). */
  distribution: [number, number, number, number, number]
}

/** Aggregate published-review stats for a product. */
export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  const rows = await prisma.review.groupBy({
    by: ["rating"],
    where: { productId, hidden: false },
    _count: { _all: true },
  })
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  let total = 0
  let sum = 0
  for (const r of rows) {
    const c = r._count._all
    if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1] = c
    total += c
    sum += c * r.rating
  }
  return {
    average: total > 0 ? Math.round((sum / total) * 10) / 10 : null,
    count: total,
    distribution,
  }
}

/**
 * List published reviews for a product, newest first. When a viewer id is
 * provided, their own review (even if hidden) is flagged with `mine`.
 */
export async function listReviews(
  productId: string,
  viewerId?: string,
  limit = 50,
): Promise<ReviewView[]> {
  const reviews = await prisma.review.findMany({
    where: { productId, OR: [{ hidden: false }, ...(viewerId ? [{ userId: viewerId }] : [])] },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, displayName: true } } },
  })
  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    authorName: r.user.displayName ?? "—",
    createdAt: r.createdAt,
    mine: !!viewerId && r.userId === viewerId,
  }))
}

/** Whether a user is eligible to review (must have a paid/delivered order). */
export async function canReview(userId: string, productId: string): Promise<boolean> {
  const order = await prisma.order.findFirst({
    where: { userId, productId, status: { in: ["PAID", "DELIVERED"] } },
    select: { id: true },
  })
  return !!order
}

/** The viewer's existing review for a product, if any. */
export async function getMyReview(userId: string, productId: string) {
  return prisma.review.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true, rating: true, comment: true, hidden: true },
  })
}

/**
 * Create or update the caller's review for a product. Gated behind a real
 * purchase so ratings reflect genuine buyers. Returns the upserted review.
 */
export async function upsertReview(
  userId: string,
  productId: string,
  rating: number,
  comment?: string,
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError("Rating must be an integer between 1 and 5")
  }
  const trimmed = comment?.trim() ?? null
  if (trimmed && trimmed.length > 1000) {
    throw new ValidationError("Comment too long")
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
  if (!product) throw new NotFoundError("Product not found")

  if (!(await canReview(userId, productId))) {
    throw new ForbiddenError("Only buyers who purchased this product can review it")
  }

  return prisma.review.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, rating, comment: trimmed },
    update: { rating, comment: trimmed, hidden: false },
  })
}

/** Delete the caller's own review (idempotent). */
export async function deleteMyReview(userId: string, productId: string) {
  await prisma.review.deleteMany({ where: { userId, productId } })
  return { deleted: true }
}
