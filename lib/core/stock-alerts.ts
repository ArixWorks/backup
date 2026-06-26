import { prisma } from "@/lib/db"
import { NotFoundError } from "./errors"
import { createNotifications } from "./notifications"

/** Available units for a fixed-sale product (stock minus reserved). */
function availableStock(fixedSale: { stock: number; reservedStock: number } | null): number {
  if (!fixedSale) return 0
  return Math.max(0, fixedSale.stock - fixedSale.reservedStock)
}

/**
 * Subscribe the current user to a product's back-in-stock alert. This doubles
 * as the flash-sale "product watchlist". Idempotent.
 */
export async function watchProduct(userId: string, productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { fixedSale: true },
  })
  if (!product || product.saleMode !== "FIXED_PRICE") throw new NotFoundError("محصول یافت نشد")
  // If it's already in stock, mark notified so we only alert on the NEXT restock.
  const inStock = availableStock(product.fixedSale) > 0
  await prisma.stockAlert.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, notified: inStock },
    update: {},
  })
  return { watching: true }
}

/** Unsubscribe from a product's stock alert / remove from watchlist. Idempotent. */
export async function unwatchProduct(userId: string, productId: string) {
  await prisma.stockAlert.deleteMany({ where: { userId, productId } })
  return { watching: false }
}

/** Whether the user currently watches a product. */
export async function isWatchingProduct(userId: string, productId: string): Promise<boolean> {
  const entry = await prisma.stockAlert.findUnique({
    where: { userId_productId: { userId, productId } },
  })
  return !!entry
}

/** List the user's watched flash products with lightweight summaries. */
export async function listWatchedProducts(userId: string) {
  const entries = await prisma.stockAlert.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { product: { include: { fixedSale: true } } },
  })
  return entries.map((e) => ({
    id: e.product.id,
    slug: e.product.slug,
    title: e.product.title,
    coverImage: e.product.coverImage,
    price: Number(e.product.fixedSale?.price ?? 0),
    stock: availableStock(e.product.fixedSale),
    hidden: e.product.hidden,
    active: e.product.active,
    createdAt: e.createdAt,
  }))
}

/**
 * Reconcile stock-alert state for a product after any stock change.
 *
 * - If the product is now in stock: fan out a notification to every subscriber
 *   that hasn't been notified for this restock cycle, then mark them notified.
 * - If the product is out of stock: reset `notified` so subscribers will be
 *   alerted again on the next restock.
 *
 * Best-effort and self-contained: callers invoke it after mutating stock.
 */
export async function reconcileStockAlerts(productId: string): Promise<number> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { fixedSale: true },
  })
  if (!product || product.saleMode !== "FIXED_PRICE") return 0

  const available = availableStock(product.fixedSale)

  if (available <= 0) {
    // Sold out — arm alerts for the next restock.
    await prisma.stockAlert.updateMany({
      where: { productId, notified: true },
      data: { notified: false },
    })
    return 0
  }

  // Back in stock — notify everyone still waiting.
  const pending = await prisma.stockAlert.findMany({
    where: { productId, notified: false },
    select: { userId: true },
  })
  if (pending.length === 0) return 0

  await createNotifications(
    pending.map((p) => ({
      userId: p.userId,
      type: "BACK_IN_STOCK" as const,
      title: "محصول موجود شد",
      body: `«${product.title}» دوباره موجود شد. برای خرید عجله کنید!`,
      href: `/flash/${product.id}`,
      image: product.coverImage,
    })),
  )

  await prisma.stockAlert.updateMany({
    where: { productId, notified: false },
    data: { notified: true },
  })

  // Best-effort Telegram push (never blocks/throws).
  void pushBackInStockTelegram(
    pending.map((p) => p.userId),
    product.title,
    product.id,
    product.coverImage,
  )

  return pending.length
}

/** Fire-and-forget Telegram pushes for back-in-stock. Imported lazily so the
 *  core module stays usable in non-server contexts. */
async function pushBackInStockTelegram(
  userIds: string[],
  title: string,
  productId: string,
  photo: string | null,
) {
  try {
    const { notifyBackInStock } = await import("@/lib/telegram/notify")
    await Promise.all(userIds.map((id) => notifyBackInStock(id, title, productId, photo)))
  } catch {
    // Telegram is optional; ignore failures.
  }
}
