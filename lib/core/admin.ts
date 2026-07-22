import { prisma } from "@/lib/db"
import { ConflictError, NotFoundError, ValidationError } from "./errors"
import { mutateWallet, ensureWallet } from "./wallet"
import { BASE_CURRENCY, serializableTx } from "./ledger"
import { audit } from "./audit"
import { notifyOrderDelivered } from "@/lib/telegram/notify"

// --- Dashboard ---------------------------------------------------------------

export async function dashboardStats() {
  const [
    userCount,
    activeAuctions,
    pendingDeposits,
    pendingWithdrawals,
    pendingDeliveries,
    failedDeliveries,
  lowInventory,
  pendingRefunds,
  openTickets,
  walletAgg,
  revenueAgg,
  recentOrders,
  ] = await Promise.all([
    prisma.user.count({ where: { isTestAccount: false } }),
    prisma.auction.count({ where: { status: "ACTIVE" } }),
    prisma.depositRequest.count({ where: { status: "PENDING" } }),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.delivery.count({ where: { status: "PENDING" } }),
    prisma.delivery.count({ where: { status: "FAILED" } }),
    prisma.product.count({ where: { saleMode: "FIXED_PRICE", active: true } }),
    prisma.refundRequest.count({ where: { status: "PENDING" } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
    prisma.wallet.aggregate({ _sum: { totalBalance: true, frozenBalance: true } }),
    prisma.order.aggregate({
      _sum: { amount: true },
      where: { status: { in: ["PAID", "DELIVERED"] } },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { displayName: true, alias: true } },
        product: { select: { title: true } },
      },
    }),
  ])

  return {
    userCount,
    activeAuctions,
    pendingDeposits,
    pendingWithdrawals,
    pendingDeliveries,
    failedDeliveries,
    lowInventory,
    pendingRefunds,
    openTickets,
    totalBalance: walletAgg._sum.totalBalance ?? 0n,
    frozenBalance: walletAgg._sum.frozenBalance ?? 0n,
    revenue: revenueAgg._sum.amount ?? 0n,
    recentOrders,
  }
}

// --- Users -------------------------------------------------------------------

export async function listUsers(query?: string) {
  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { alias: { contains: query, mode: "insensitive" } },
            { username: { contains: query, mode: "insensitive" } },
            { telegramUsername: { contains: query.replace(/^@/, ""), mode: "insensitive" } },
            { telegramId: { contains: query, mode: "insensitive" } },
            { telegramChatId: { contains: query, mode: "insensitive" } },
            { id: { equals: query } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      wallets: { where: { currency: BASE_CURRENCY }, take: 1 },
      _count: { select: { orders: true, bids: true } },
    },
  })
  // Flatten the base-currency wallet to a single `wallet` field for the UI.
  return users.map(({ wallets, ...u }) => ({ ...u, wallet: wallets[0] ?? null }))
}

export async function setUserStatus(userId: string, status: "ACTIVE" | "BANNED", adminId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError("کاربر یافت نشد")
  if (user.role === "ADMIN" && status === "BANNED") {
    throw new ValidationError("نمی‌توان حساب مدیر را مسدود کرد")
  }
  const updated = await prisma.user.update({ where: { id: userId }, data: { status } })
  await audit({ actorId: adminId, action: status === "BANNED" ? "user.ban" : "user.unban", entity: "user", entityId: userId })
  return updated
}

/**
 * Permanently delete a user and ALL of their data from the database.
 *
 * Every required relation to `User` is declared `onDelete: Cascade` in the
 * schema (wallets, ledger accounts, orders, deliveries, bids, deposits,
 * withdrawals, refunds, tickets, reviews, coupon redemptions, notifications,
 * stock alerts, category follows, auth tokens, giveaway entries/wins, points,
 * badges, missions, conversions…), so a single delete self-cleans everything.
 * Optional back-references are preserved safely: `AuditLog.actor` and
 * `User.referredBy` are `SetNull`, so audit history and other users' referral
 * chains stay intact (just detached).
 *
 * Because the Telegram identity row is removed too, the next time this person
 * opens the bot / Mini App `resolveTelegramUser` treats them as a brand-new
 * user (fresh wallet, fresh onboarding).
 */
export async function deleteUser(userId: string, adminId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, displayName: true, alias: true, telegramId: true },
  })
  if (!user) throw new NotFoundError("کاربر یافت نشد")
  if (user.role === "ADMIN") throw new ValidationError("نمی‌توان حساب مدیر را حذف کرد")
  if (userId === adminId) throw new ValidationError("نمی‌توانید حساب خودتان را حذف کنید")

  await prisma.user.delete({ where: { id: userId } })
  await audit({
    actorId: adminId,
    action: "user.delete",
    entity: "user",
    entityId: userId,
    meta: { displayName: user.displayName, alias: user.alias, telegramId: user.telegramId },
  })
  return { deleted: true }
}

/** Manual balance adjustment (credit or debit) with an immutable ledger entry. */
export async function adjustBalance(userId: string, delta: bigint, reason: string, adminId: string) {
  if (delta === 0n) throw new ValidationError("مبلغ نمی‌تواند صفر باشد")
  return serializableTx(async (tx) => {
    await ensureWallet(userId, tx)
    const balances = await mutateWallet(
      {
        userId,
        type: "ADMIN_ADJUSTMENT",
        deltaTotal: delta,
        amount: delta,
        refType: "admin",
        refId: adminId,
        note: reason,
      },
      tx,
    )
    await audit({ actorId: adminId, action: "wallet.adjust", entity: "user", entityId: userId, meta: { delta: delta.toString(), reason } }, tx)
    return balances
  })
}

// --- Orders & manual delivery ------------------------------------------------

export async function listOrders(status?: string) {
  return prisma.order.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { displayName: true, alias: true } },
      product: { select: { title: true } },
      delivery: true,
    },
  })
}

export async function listPendingDeliveries() {
  return prisma.delivery.findMany({
    where: { status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      order: {
        include: {
          user: { select: { displayName: true, alias: true } },
          product: {
            select: {
              title: true,
              defaultTutorial: { select: { id: true, title: true, slug: true } },
            },
          },
        },
      },
    },
  })
}

/** Complete a manual delivery by attaching a payload and marking delivered. */
export async function completeManualDelivery(
  deliveryId: string,
  payload: Record<string, unknown>,
  adminId: string,
  tutorialId?: string | null,
) {
  const info = await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({ where: { id: deliveryId } })
    if (!delivery) throw new NotFoundError("تحویل یافت نشد")
    if (delivery.status === "DELIVERED") throw new ConflictError("این سفارش قبلاً تحویل شده است")
    if (tutorialId) {
      const tutorial = await tx.content.findFirst({
        where: { id: tutorialId, type: "tutorial", status: "PUBLISHED" },
        select: { id: true },
      })
      if (!tutorial) throw new ValidationError("آموزش منتشرشده معتبر نیست")
    }

    await tx.delivery.update({
      where: { id: deliveryId },
      data: {
        status: "DELIVERED",
        payload: payload as any,
        tutorialId: tutorialId || null,
        error: null,
        deliveredAt: new Date(),
      },
    })
    const order = await tx.order.update({
      where: { id: delivery.orderId },
      data: { status: "DELIVERED" },
      include: { product: { select: { title: true, coverImage: true } } },
    })
    await audit({ actorId: adminId, action: "delivery.complete", entity: "delivery", entityId: deliveryId }, tx)
    return { userId: order.userId, title: order.product.title, coverImage: order.product.coverImage }
  })
  await notifyOrderDelivered(info.userId, info.title, info.coverImage)
  try {
    const { createNotification } = await import("./notifications")
    await createNotification({
      userId: info.userId,
      type: "ORDER_DELIVERED",
      title: "سفارش تحویل شد",
      body: `سفارش «${info.title}» تحویل داده شد. برای مشاهده کلیک کنید.`,
      href: "/orders",
      image: info.coverImage,
    })
  } catch (e) {
    console.log("[v0] order-delivered notif error:", (e as Error).message)
  }
  return info
}

/** Mark a delivery as failed (e.g. exhausted inventory) for follow-up. */
export async function markDeliveryFailed(deliveryId: string, error: string, adminId: string) {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } })
  if (!delivery) throw new NotFoundError("تحویل یافت نشد")
  await prisma.delivery.update({ where: { id: deliveryId }, data: { status: "FAILED", error } })
  await audit({ actorId: adminId, action: "delivery.fail", entity: "delivery", entityId: deliveryId, meta: { error } })
}

// --- Inventory pool ----------------------------------------------------------

export async function listInventory(productId: string, variantId?: string | null) {
  return prisma.inventoryItem.findMany({
    // Scope to a specific sale plan when given; otherwise the whole product.
    where: variantId ? { productId, variantId } : { productId },
    orderBy: { createdAt: "desc" },
    take: 500,
  })
}

export interface InventoryItemInput {
  username?: string
  password?: string
  licenseKey?: string
  note?: string
}

/**
 * Bulk-add inventory items to a product's automatic-delivery pool. When a
 * variantId is given the credentials are attached to that specific sale plan's
 * pool; otherwise they belong to the product pool (legacy single-plan).
 */
export async function addInventoryItems(
  productId: string,
  items: InventoryItemInput[],
  adminId: string,
  variantId?: string | null,
) {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) throw new NotFoundError("محصول یافت نشد")
  if (variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true },
    })
    if (!variant) throw new NotFoundError("پلن یافت نشد")
  }
  const clean = items.filter((i) => i.username || i.password || i.licenseKey || i.note)
  if (clean.length === 0) throw new ValidationError("حداقل یک آیتم معتبر وارد کنید")

  const created = await prisma.inventoryItem.createMany({
    data: clean.map((i) => ({
      productId,
      variantId: variantId ?? null,
      username: i.username || null,
      password: i.password || null,
      licenseKey: i.licenseKey || null,
      note: i.note || null,
    })),
  })
  await audit({ actorId: adminId, action: "inventory.add", entity: "product", entityId: productId, meta: { count: created.count } })
  try {
    const { reconcileStockAlerts } = await import("./stock-alerts")
    await reconcileStockAlerts(productId)
  } catch (e) {
    console.log("[v0] reconcileStockAlerts (inventory) error:", (e as Error).message)
  }
  return { added: created.count }
}

export async function deleteInventoryItem(itemId: string, adminId: string) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } })
  if (!item) throw new NotFoundError("آیتم یافت نشد")
  if (item.status === "DELIVERED") throw new ConflictError("آیتم تحویل‌شده قابل حذف نیست")
  await prisma.inventoryItem.delete({ where: { id: itemId } })
  await audit({ actorId: adminId, action: "inventory.delete", entity: "inventory", entityId: itemId })
}
