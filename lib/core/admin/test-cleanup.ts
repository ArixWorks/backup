import "server-only"

import type { OrderStatus, OrderType, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/core/errors"
import { serializableTx } from "@/lib/core/ledger"
import { mutateWallet, refund } from "@/lib/core/wallet"
import { requireAdmin } from "@/lib/auth/session"
import { isBootstrapAdminTelegramId } from "@/lib/telegram/user"

export type CleanupFilters = {
  query?: string
  status?: OrderStatus
  type?: OrderType
  productId?: string
}

export async function requireTestCleanupOwner() {
  const admin = await requireAdmin()
  if (process.env.ADMIN_TEST_CLEANUP_ENABLED !== "true") {
    throw new ForbiddenError("پاک‌سازی آزمایشی در این محیط غیرفعال است")
  }
  if (!isBootstrapAdminTelegramId(admin.telegramId)) {
    throw new ForbiddenError("این عملیات فقط برای مالک اصلی مجاز است")
  }
  return admin
}

export function cleanupOrderWhere(filters: CleanupFilters): Prisma.OrderWhereInput {
  const query = filters.query?.trim()
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(query
      ? {
          OR: [
            { publicId: { contains: query, mode: "insensitive" } },
            { product: { title: { contains: query, mode: "insensitive" } } },
            { user: { displayName: { contains: query, mode: "insensitive" } } },
            { user: { alias: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  }
}

export async function listCleanupOrders(filters: CleanupFilters, page = 1, pageSize = 30) {
  const where = cleanupOrderWhere(filters)
  const skip = (Math.max(1, page) - 1) * pageSize
  const [orders, total, aggregate] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: { select: { displayName: true, alias: true } },
        product: { select: { title: true, coverImage: true } },
        delivery: { select: { status: true, method: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { amount: true } }),
  ])
  return { orders, total, refundTotal: aggregate._sum.amount ?? 0n, page, pageSize }
}

async function reverseOrder(orderId: string, adminId: string) {
  return serializableTx(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { delivery: true },
    })
    if (!order) return null

    const alreadyRefunded = await tx.walletTransaction.findFirst({
      where: { type: "REFUND", refType: "test_cleanup_order", refId: order.id },
      select: { id: true },
    })
    if (alreadyRefunded) throw new ValidationError(`سفارش ${order.publicId} قبلاً بازپرداخت شده است`)

    // Remove order-linked rewards before refunding the original charge. Referral
    // one-time bonuses are intentionally preserved because they can be shared by
    // other test purchases; cashback/commission tied directly to this order are
    // debited through explicit wallet adjustments only when present.
    const rewardTxs = await tx.walletTransaction.findMany({
      where: {
        OR: [
          { refType: "order", refId: order.id, type: "CASHBACK" },
          { refType: "referral_commission", refId: order.id, type: "REFERRAL_BONUS" },
        ],
      },
      include: { wallet: { select: { userId: true } } },
    })
    for (const rewardTx of rewardTxs) {
      await mutateWallet({
        userId: rewardTx.wallet.userId,
        type: "ADMIN_ADJUSTMENT",
        amount: rewardTx.amount,
        deltaTotal: -rewardTx.amount,
        refType: "test_cleanup_reward",
        refId: rewardTx.id,
        createdById: adminId,
        note: `Reverse ${rewardTx.type} for test order ${order.publicId}`,
      }, tx)
    }

    await refund(order.userId, order.amount, tx, { type: "test_cleanup_order", id: order.id })

    if (order.variantId) {
      await tx.productVariant.update({
        where: { id: order.variantId },
        data: { stock: { increment: order.quantity }, soldCount: { decrement: order.quantity }, version: { increment: 1 } },
      })
    } else if (order.type === "FIXED_PURCHASE") {
      await tx.fixedSale.update({
        where: { productId: order.productId },
        data: { stock: { increment: order.quantity }, soldCount: { decrement: order.quantity }, version: { increment: 1 } },
      })
    }

    if (order.delivery?.inventoryItemId) {
      await tx.inventoryItem.update({
        where: { id: order.delivery.inventoryItemId },
        data: { status: "AVAILABLE", reservedAt: null },
      })
    }

    const redemption = await tx.couponRedemption.findUnique({ where: { orderId: order.id } })
    if (redemption) {
      await tx.coupon.update({ where: { id: redemption.couponId }, data: { usedCount: { decrement: 1 } } })
      await tx.couponRedemption.delete({ where: { id: redemption.id } })
    }

    await tx.order.delete({ where: { id: order.id } })
    await audit({
      actorId: adminId,
      action: "test_cleanup.order.delete",
      entity: "order",
      entityId: order.id,
      meta: { publicId: order.publicId, refund: order.amount.toString(), productId: order.productId },
    }, tx)
    return { id: order.id, amount: order.amount, productId: order.productId }
  }, { label: "test-cleanup-order" })
}

export async function cleanupOrders(ids: string[], adminId: string) {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (!unique.length) throw new ValidationError("حداقل یک سفارش انتخاب کنید")
  const deleted: string[] = []
  const skipped: { id: string; reason: string }[] = []
  let refunded = 0n
  for (const id of unique) {
    try {
      const result = await reverseOrder(id, adminId)
      if (result) {
        deleted.push(id)
        refunded += result.amount
      } else skipped.push({ id, reason: "سفارش یافت نشد" })
    } catch (error) {
      skipped.push({ id, reason: error instanceof Error ? error.message : "خطا در پاک‌سازی" })
    }
  }
  return { deleted, skipped, refunded }
}

export async function cleanupFilteredOrders(filters: CleanupFilters, adminId: string) {
  const ids = await prisma.order.findMany({ where: cleanupOrderWhere(filters), select: { id: true }, take: 1000 })
  if (ids.length === 1000) throw new ValidationError("برای پاک‌سازی بیش از ۱۰۰۰ خرید، فیلتر دقیق‌تری انتخاب کنید")
  return cleanupOrders(ids.map((order) => order.id), adminId)
}

export async function cleanupProductOrders(productId: string, adminId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
  if (!product) throw new NotFoundError("محصول یافت نشد")
  const orders = await prisma.order.findMany({ where: { productId }, select: { id: true } })
  return cleanupOrders(orders.map((order) => order.id), adminId)
}
