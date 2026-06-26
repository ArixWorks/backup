import type { Prisma, WalletTxType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { BASE_CURRENCY } from "./ledger"

export interface StatementFilters {
  userId: string
  currency?: string
  /** Filter to a single transaction type. */
  type?: WalletTxType
  /** ISO date strings (inclusive lower / exclusive upper bounds). */
  from?: string
  to?: string
  /** Free-text search over note / refType / refId. */
  q?: string
  /** Pagination. */
  take?: number
  skip?: number
}

function buildWhere(f: StatementFilters): Prisma.WalletTransactionWhereInput {
  const where: Prisma.WalletTransactionWhereInput = {
    wallet: { userId: f.userId },
    currency: f.currency ?? BASE_CURRENCY,
  }
  if (f.type) where.type = f.type
  if (f.from || f.to) {
    where.createdAt = {}
    if (f.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(f.from)
    if (f.to) (where.createdAt as Prisma.DateTimeFilter).lt = new Date(f.to)
  }
  if (f.q && f.q.trim()) {
    const q = f.q.trim()
    where.OR = [
      { note: { contains: q, mode: "insensitive" } },
      { refType: { contains: q, mode: "insensitive" } },
      { refId: { contains: q, mode: "insensitive" } },
    ]
  }
  return where
}

/** Paginated, filtered transactions for the statement view. */
export async function queryStatement(f: StatementFilters) {
  const where = buildWhere(f)
  const take = Math.min(Math.max(f.take ?? 50, 1), 200)
  const [rows, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip: f.skip ?? 0,
    }),
    prisma.walletTransaction.count({ where }),
  ])
  return { rows, total, take }
}

/** All matching rows (no pagination) for CSV export — capped for safety. */
export async function queryStatementForExport(f: StatementFilters) {
  return prisma.walletTransaction.findMany({
    where: buildWhere(f),
    orderBy: { createdAt: "desc" },
    take: 5000,
  })
}
