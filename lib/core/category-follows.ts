import { prisma } from "@/lib/db"
import { requireUser } from "@/lib/auth/session"
import { createNotifications } from "./notifications"

/** List the categories the current user follows. */
export async function listFollowedCategories(): Promise<string[]> {
  const user = await requireUser()
  const rows = await prisma.categoryFollow.findMany({
    where: { userId: user.id },
    select: { category: true },
    orderBy: { createdAt: "desc" },
  })
  return rows.map((r) => r.category)
}

/** Whether the current user follows a given category. */
export async function isFollowingCategory(category: string): Promise<boolean> {
  const user = await requireUser()
  const row = await prisma.categoryFollow.findUnique({
    where: { userId_category: { userId: user.id, category } },
    select: { id: true },
  })
  return Boolean(row)
}

/** Follow a category (idempotent). */
export async function followCategory(category: string): Promise<{ following: true }> {
  const user = await requireUser()
  const trimmed = category.trim()
  if (!trimmed) throw new Error("category required")
  await prisma.categoryFollow.upsert({
    where: { userId_category: { userId: user.id, category: trimmed } },
    create: { userId: user.id, category: trimmed },
    update: {},
  })
  return { following: true }
}

/** Unfollow a category (idempotent). */
export async function unfollowCategory(category: string): Promise<{ following: false }> {
  const user = await requireUser()
  await prisma.categoryFollow
    .delete({ where: { userId_category: { userId: user.id, category: category.trim() } } })
    .catch(() => {})
  return { following: false }
}

/**
 * Fan out a NEW_PRODUCT notification to every follower of the product's
 * category. Best-effort: never throws into the caller's flow. The product's
 * own buyer/creator is irrelevant here (admin creates products), so all
 * followers are notified. Returns the number of notifications created.
 */
export async function notifyNewProduct(opts: {
  productId: string
  title: string
  category: string
  coverImage?: string | null
  href?: string
}): Promise<number> {
  const category = opts.category?.trim()
  if (!category) return 0
  const href = opts.href ?? `/flash/${opts.productId}`

  const followers = await prisma.categoryFollow.findMany({
    where: { category },
    select: { userId: true },
  })
  if (followers.length === 0) return 0

  const res = await createNotifications(
    followers.map((f) => ({
      userId: f.userId,
      type: "NEW_PRODUCT" as const,
      title: "محصول جدید!",
      body: `محصول جدیدی در دسته «${category}» اضافه شد: ${opts.title}`,
      href,
      image: opts.coverImage ?? undefined,
    })),
  ).catch(() => ({ count: 0 }))
  return res.count
}
