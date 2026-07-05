import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { dashboardStats } from "@/lib/core/admin"

/**
 * Read-only Copilot tools for the admin AI assistant.
 *
 * SECURITY: Every tool here is strictly read-only. The Copilot must never be
 * able to mutate data through tools — mutations always stay behind explicit
 * admin UI actions with their own auth + audit. Numeric money fields are
 * BigInt in the DB and are serialized to strings so the model gets exact values.
 */

function money(v: bigint | null | undefined): string {
  return (v ?? 0n).toString()
}

export const copilotTools = {
  getDashboardStats: tool({
    description:
      "دریافت آمار کلی فروشگاه: تعداد کاربران، مزایده‌های فعال، واریز/برداشت در انتظار، تحویل‌های در انتظار/ناموفق، تیکت‌های باز، موجودی کل کیف‌پول‌ها و درآمد. برای سوالات کلی وضعیت فروشگاه استفاده شود.",
    inputSchema: z.object({}),
    execute: async () => {
      const s = await dashboardStats()
      return {
        userCount: s.userCount,
        activeAuctions: s.activeAuctions,
        pendingDeposits: s.pendingDeposits,
        pendingWithdrawals: s.pendingWithdrawals,
        pendingDeliveries: s.pendingDeliveries,
        failedDeliveries: s.failedDeliveries,
        pendingRefunds: s.pendingRefunds,
        openTickets: s.openTickets,
        totalBalance: money(s.totalBalance),
        frozenBalance: money(s.frozenBalance),
        revenue: money(s.revenue),
      }
    },
  }),

  searchProducts: tool({
    description:
      "جستجوی محصولات بر اساس عنوان. برای یافتن محصول، بررسی قیمت، وضعیت فعال بودن و حالت فروش استفاده شود.",
    inputSchema: z.object({
      query: z.string().min(1).describe("بخشی از عنوان محصول"),
      limit: z.number().int().min(1).max(20).default(8),
    }),
    execute: async ({ query, limit }) => {
      const rows = await prisma.product.findMany({
        where: { title: { contains: query, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          title: true,
          active: true,
          saleMode: true,
          createdAt: true,
          fixedSale: { select: { price: true, stock: true } },
        },
      })
      return rows.map((p) => ({
        id: p.id,
        title: p.title,
        active: p.active,
        saleMode: p.saleMode,
        price: p.fixedSale ? money(p.fixedSale.price) : null,
        stock: p.fixedSale?.stock ?? null,
        createdAt: p.createdAt.toISOString(),
      }))
    },
  }),

  findUser: tool({
    description:
      "یافتن کاربر بر اساس نام نمایشی، نام کاربری، ایمیل یا نام مستعار. اطلاعات پایه و موجودی کیف‌پول پایه را برمی‌گرداند. اطلاعات حساس نمایش داده نمی‌شود.",
    inputSchema: z.object({
      query: z.string().min(1).describe("نام، نام کاربری، ایمیل یا نام مستعار"),
      limit: z.number().int().min(1).max(10).default(5),
    }),
    execute: async ({ query, limit }) => {
      const rows = await prisma.user.findMany({
        where: {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { alias: { contains: query, mode: "insensitive" } },
            { username: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          displayName: true,
          username: true,
          status: true,
          role: true,
          createdAt: true,
          _count: { select: { orders: true, bids: true } },
        },
      })
      return rows.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        username: u.username,
        status: u.status,
        role: u.role,
        orders: u._count.orders,
        bids: u._count.bids,
        createdAt: u.createdAt.toISOString(),
      }))
    },
  }),

  listRecentOrders: tool({
    description:
      "فهرست سفارش‌های اخیر با امکان فیلتر بر اساس وضعیت (PENDING, PAID, DELIVERED, CANCELLED, REFUNDED). برای بررسی وضعیت فروش و سفارش‌ها استفاده شود.",
    inputSchema: z.object({
      status: z
        .enum(["PENDING", "PAID", "DELIVERED", "CANCELLED", "REFUNDED"])
        .optional()
        .describe("فیلتر وضعیت سفارش"),
      limit: z.number().int().min(1).max(25).default(10),
    }),
    execute: async ({ status, limit }) => {
      const rows = await prisma.order.findMany({
        where: status ? { status: status as never } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          status: true,
          amount: true,
          createdAt: true,
          user: { select: { displayName: true } },
          product: { select: { title: true } },
        },
      })
      return rows.map((o) => ({
        id: o.id,
        status: o.status,
        amount: money(o.amount),
        buyer: o.user?.displayName ?? "—",
        product: o.product?.title ?? "—",
        createdAt: o.createdAt.toISOString(),
      }))
    },
  }),
}

export type CopilotToolSet = typeof copilotTools
