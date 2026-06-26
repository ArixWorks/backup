import type { Prisma, WalletTxType, LedgerAccountKind } from "@prisma/client"
import { prisma } from "@/lib/db"
import { secureSlug } from "@/lib/id"
import { ConflictError, ValidationError } from "./errors"

type Tx = Prisma.TransactionClient

/** The single base currency. Every existing money path operates in IRT. */
export const BASE_CURRENCY = "IRT"

/**
 * Maps a wallet transaction type to the system account that sits on the other
 * side of the entry. FREEZE/UNFREEZE/CONVERSION return null because they have a
 * dedicated handling path (internal transfer / FX clearing) rather than a
 * single system counterparty.
 */
export function systemAccountForType(type: WalletTxType): LedgerAccountKind | null {
  switch (type) {
    case "DEPOSIT":
      return "SYS_CASH"
    case "WITHDRAWAL":
      return "SYS_WITHDRAWALS_PAYABLE"
    case "PURCHASE":
    case "REFUND":
      return "SYS_REVENUE"
    case "CASHBACK":
    case "REFERRAL_BONUS":
      return "SYS_PROMO_EXPENSE"
    case "ADMIN_ADJUSTMENT":
      return "SYS_ADJUSTMENTS"
    // Pure escrow moves between a user's own available/frozen sub-accounts.
    case "FREEZE":
    case "UNFREEZE":
    case "BID_LOCK":
    case "BID_RELEASE":
    case "CONVERSION":
      return null
    default:
      return null
  }
}

/**
 * Fetch (or lazily create) a ledger account. USER_* accounts are scoped by
 * ownerUserId; SYS_* accounts are global (ownerUserId = null).
 */
export async function getOrCreateAccount(
  db: Tx,
  kind: LedgerAccountKind,
  currency: string,
  ownerUserId: string | null = null,
) {
  // ownerUserId may be null (system accounts), so use findFirst rather than the
  // compound unique lookup, which Prisma types as non-nullable.
  const existing = await db.ledgerAccount.findFirst({ where: { kind, ownerUserId, currency } })
  if (existing) return existing
  // Create, tolerating a concurrent creator that won the unique-constraint race.
  try {
    return await db.ledgerAccount.create({ data: { kind, ownerUserId, currency } })
  } catch {
    const row = await db.ledgerAccount.findFirst({ where: { kind, ownerUserId, currency } })
    if (!row) throw new ConflictError("Failed to create ledger account")
    return row
  }
}

export interface LegInput {
  kind: LedgerAccountKind
  ownerUserId?: string | null
  amount: bigint // signed
}

export interface PostEntryArgs {
  kind: WalletTxType
  currency: string
  legs: LegInput[]
  refType?: string
  refId?: string
  memo?: string
  createdById?: string
  walletTxId?: string
}

/**
 * Post a balanced double-entry record. Validates that there are at least two
 * legs and that their signed amounts sum to exactly zero, then applies each leg
 * to its account under optimistic locking and snapshots the running balance.
 * MUST run inside a transaction.
 */
export async function postEntry(db: Tx, args: PostEntryArgs) {
  const { kind, currency, legs, refType, refId, memo, createdById, walletTxId } = args

  if (legs.length < 2) throw new ValidationError("A ledger entry needs at least two legs")
  const sum = legs.reduce((acc, l) => acc + l.amount, 0n)
  if (sum !== 0n) throw new ValidationError("Ledger entry legs must sum to zero")

  const entry = await db.ledgerEntry.create({
    data: { publicId: secureSlug("led"), kind, currency, refType, refId, memo, createdById, walletTxId },
  })

  for (const leg of legs) {
    if (leg.amount === 0n) continue // skip no-op legs
    const account = await getOrCreateAccount(db, leg.kind, currency, leg.ownerUserId ?? null)
    const nextBalance = account.balance + leg.amount
    // Optimistic lock on the account version to serialise concurrent legs.
    const updated = await db.ledgerAccount.updateMany({
      where: { id: account.id, version: account.version },
      data: { balance: nextBalance, version: { increment: 1 } },
    })
    if (updated.count !== 1) throw new ConflictError("Ledger account modified concurrently")
    await db.ledgerLeg.create({
      data: { entryId: entry.id, accountId: account.id, amount: leg.amount, balanceAfter: nextBalance },
    })
  }

  return entry
}

/**
 * Rebuild a user's balance purely from ledger legs (source of truth), summing
 * their USER_AVAILABLE and USER_FROZEN accounts for a currency.
 */
export async function reconstructUserBalance(userId: string, currency: string, db: Tx = prisma) {
  const accounts = await db.ledgerAccount.findMany({
    where: { ownerUserId: userId, currency, kind: { in: ["USER_AVAILABLE", "USER_FROZEN"] } },
  })
  let available = 0n
  let frozen = 0n
  for (const a of accounts) {
    if (a.kind === "USER_AVAILABLE") available = a.balance
    else if (a.kind === "USER_FROZEN") frozen = a.balance
  }
  return { availableBalance: available, frozenBalance: frozen, totalBalance: available + frozen }
}

/**
 * Verify the ledger is internally consistent: the signed balances of every
 * account in a currency must sum to zero (assets = liabilities + equity).
 */
export async function verifyZeroSum(currency: string, db: Tx = prisma) {
  const accounts = await db.ledgerAccount.findMany({ where: { currency } })
  const total = accounts.reduce((acc, a) => acc + a.balance, 0n)
  return { currency, balanced: total === 0n, residual: total }
}
