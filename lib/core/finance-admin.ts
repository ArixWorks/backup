import type { WalletTxType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { BASE_CURRENCY } from "./ledger"

export interface CurrencyTotals {
  currency: string
  totalBalance: string
  frozenBalance: string
  availableBalance: string
  walletCount: number
}

export interface SystemAccount {
  kind: string
  currency: string
  balance: string
}

export interface FlowPoint {
  date: string // YYYY-MM-DD
  inflow: string // deposits + positive credits
  outflow: string // spend (absolute)
}

/** Per-currency aggregate of all user wallets. */
async function currencyTotals(): Promise<CurrencyTotals[]> {
  const grouped = await prisma.wallet.groupBy({
    by: ["currency"],
    _sum: { totalBalance: true, frozenBalance: true },
    _count: { _all: true },
  })
  return grouped
    .map((g) => {
      const total = g._sum.totalBalance ?? 0n
      const frozen = g._sum.frozenBalance ?? 0n
      return {
        currency: g.currency,
        totalBalance: total.toString(),
        frozenBalance: frozen.toString(),
        availableBalance: (total - frozen).toString(),
        walletCount: g._count._all,
      }
    })
    .sort((a, b) => (a.currency === BASE_CURRENCY ? -1 : a.currency.localeCompare(b.currency)))
}

/** Balances of every system (SYS_*) ledger account, grouped by kind + currency. */
async function systemAccounts(): Promise<SystemAccount[]> {
  const accounts = await prisma.ledgerAccount.findMany({
    where: { ownerUserId: null },
    orderBy: [{ currency: "asc" }, { kind: "asc" }],
  })
  return accounts.map((a) => ({ kind: a.kind, currency: a.currency, balance: a.balance.toString() }))
}

/** Counts + summed amounts of pending money flows awaiting admin action. */
async function pendingFlows() {
  const [
    pendingDeposits,
    pendingDepositSum,
    pendingWithdrawals,
    pendingWithdrawalSum,
    pendingRefunds,
    pendingRefundSum,
  ] = await Promise.all([
    prisma.depositRequest.count({ where: { status: "PENDING" } }),
    prisma.depositRequest.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.withdrawalRequest.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
    prisma.refundRequest.count({ where: { status: "PENDING" } }),
    prisma.refundRequest.aggregate({ where: { status: "PENDING" }, _sum: { amount: true } }),
  ])
  return {
    deposits: { count: pendingDeposits, amount: (pendingDepositSum._sum.amount ?? 0n).toString() },
    withdrawals: {
      count: pendingWithdrawals,
      amount: (pendingWithdrawalSum._sum.amount ?? 0n).toString(),
    },
    refunds: { count: pendingRefunds, amount: (pendingRefundSum._sum.amount ?? 0n).toString() },
  }
}

const INFLOW_TYPES = new Set<WalletTxType>(["DEPOSIT", "REFUND", "CASHBACK", "REFERRAL_BONUS"])
const OUTFLOW_TYPES = new Set<WalletTxType>(["PURCHASE", "WITHDRAWAL"])

/** Daily inflow/outflow for the base currency over the last `days` days. */
async function dailyFlow(days = 30, currency = BASE_CURRENCY): Promise<FlowPoint[]> {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - (days - 1))

  const rows = await prisma.walletTransaction.findMany({
    where: { currency, createdAt: { gte: since }, type: { in: [...INFLOW_TYPES, ...OUTFLOW_TYPES] } },
    select: { type: true, amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  // Seed every day in range so the chart has no gaps.
  const buckets = new Map<string, { inflow: bigint; outflow: bigint }>()
  for (let i = 0; i < days; i++) {
    const d = new Date(since)
    d.setUTCDate(since.getUTCDate() + i)
    buckets.set(d.toISOString().slice(0, 10), { inflow: 0n, outflow: 0n })
  }
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10)
    const b = buckets.get(key)
    if (!b) continue
    const abs = r.amount < 0n ? -r.amount : r.amount
    if (INFLOW_TYPES.has(r.type)) b.inflow += abs
    else if (OUTFLOW_TYPES.has(r.type)) b.outflow += abs
  }
  return [...buckets.entries()].map(([date, v]) => ({
    date,
    inflow: v.inflow.toString(),
    outflow: v.outflow.toString(),
  }))
}

/** Aggregate revenue captured to the platform (SYS_REVENUE) per currency. */
async function revenueByCurrency() {
  const accounts = await prisma.ledgerAccount.findMany({
    where: { ownerUserId: null, kind: "SYS_REVENUE" },
  })
  // SYS_REVENUE credits are negative (counterparty of a user debit); flip sign.
  return accounts.map((a) => ({ currency: a.currency, revenue: (-a.balance).toString() }))
}

/** Full finance overview payload for the admin dashboard. */
export async function financeOverview() {
  const [totals, systems, pending, flow, revenue] = await Promise.all([
    currencyTotals(),
    systemAccounts(),
    pendingFlows(),
    dailyFlow(30),
    revenueByCurrency(),
  ])
  return { currencyTotals: totals, systemAccounts: systems, pending, dailyFlow: flow, revenue }
}
