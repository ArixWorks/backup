import { prisma } from "@/lib/db"
import { NotFoundError } from "./errors"

/**
 * Favorites ("likes"/wishlist). A pure, side-effect-free relation between a
 * user and a product — unlike StockAlert (restock notifications) and
 * WatchlistEntry (auction watch), adding a favorite never sends notifications.
 * All queries are scoped by userId (no RLS on this database).
 */

/** Add a product to the current user's favorites. Idempotent. */
export async function addFavorite(userId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) throw new NotFoundError("محصول یافت نشد")
  await prisma.favorite.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  })
  return { favorited: true }
}

/** Remove a product from the current user's favorites. Idempotent. */
export async function removeFavorite(userId: string, productId: string) {
  await prisma.favorite.deleteMany({ where: { userId, productId } })
  return { favorited: false }
}

/** Whether the user currently favorites a product. */
export async function isFavorited(userId: string, productId: string): Promise<boolean> {
  const entry = await prisma.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true },
  })
  return !!entry
}

/** Total number of favorites a product has across all users. */
export async function countFavorites(productId: string): Promise<number> {
  return prisma.favorite.count({ where: { productId } })
}

/** List the current user's favorited products with lightweight summaries. */
export async function listFavorites(userId: string) {
  const entries = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: { include: { fixedSale: true, auction: { select: { id: true } } } },
    },
    take: 100,
  })
  return entries.map((e) => ({
    id: e.product.id,
    slug: e.product.slug,
    title: e.product.title,
    subtitle: e.product.subtitle,
    coverImage: e.product.coverImage,
    saleMode: e.product.saleMode,
    price: Number(e.product.fixedSale?.price ?? 0),
    auctionId: e.product.auction?.id ?? null,
    hidden: e.product.hidden,
    active: e.product.active,
    createdAt: e.createdAt,
  }))
}
