import type { Prisma, WalletTxType } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ConflictError, InsufficientFundsError, NotFoundError } from "./errors"

type Tx = Prisma.TransactionClient

export interface WalletBalances {
  totalBalance: bigint
  frozenBalance: bigint
  availableBalance: bigint
}

/** Ensure a wallet row exists for the user. */
export async function ensureWallet(userId: string, db: Tx = prisma): Promise<void> {
  await db.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })
}

export async function getBalances(userId: string, db: Tx = prisma): Promise<WalletBalances> {
  const wallet = await db.wallet.findUnique({ where: { userId } })
  if (!wallet) throw new NotFoundError("Wallet not found")
  return {
    totalBalance: wallet.totalBalance,
    frozenBalance: wallet.frozenBalance,
    availableBalance: wallet.totalBalance - wallet.frozenBalance,
  }
}

interface MutateArgs {
  userId: string
  type: WalletTxType
  /** Signed change to total balance. */
  deltaTotal?: bigint
  /** Signed change to frozen balance. */
  deltaFrozen?: bigint
  /** Signed amount recorded on the ledger entry (semantic, for reporting). */
  amount: bigint
  refType?: string
  refId?: string
  note?: string
}

/**
 * Atomically mutate a wallet and append an immutable ledger entry.
 * Enforces invariants: total >= 0, frozen >= 0, frozen <= total.
 * Uses optimistic locking (version) so concurrent mutations cannot interleave.
 * MUST be called inside a transaction for multi-step operations.
 */
export async function mutateWallet(args: MutateArgs, db: Tx): Promise<WalletBalances> {
  const { userId, type, amount, refType, refId, note } = args
  const deltaTotal = args.deltaTotal ?? 0n
  const deltaFrozen = args.deltaFrozen ?? 0n

  const wallet = await db.wallet.findUnique({ where: { userId } })
  if (!wallet) throw new NotFoundError("Wallet not found")

  const nextTotal = wallet.totalBalance + deltaTotal
  const nextFrozen = wallet.frozenBalance + deltaFrozen

  if (nextTotal < 0n) throw new InsufficientFundsError("Operation would make balance negative")
  if (nextFrozen < 0n) throw new InsufficientFundsError("Operation would make frozen negative")
  if (nextFrozen > nextTotal) {
    throw new InsufficientFundsError("Frozen amount cannot exceed total balance")
  }

  // Optimistic lock: only update if version is unchanged since we read it.
  const updated = await db.wallet.updateMany({
    where: { id: wallet.id, version: wallet.version },
    data: {
      totalBalance: nextTotal,
      frozenBalance: nextFrozen,
      version: { increment: 1 },
    },
  })
  if (updated.count !== 1) {
    throw new ConflictError("Wallet was modified concurrently")
  }

  await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type,
      amount,
      balanceAfter: nextTotal,
      frozenAfter: nextFrozen,
      refType,
      refId,
      note,
    },
  })

  return {
    totalBalance: nextTotal,
    frozenBalance: nextFrozen,
    availableBalance: nextTotal - nextFrozen,
  }
}

// --- High-level operations ---------------------------------------------------

/** Credit funds (e.g. approved deposit). */
export function deposit(userId: string, amount: bigint, db: Tx, ref?: { type: string; id: string }) {
  return mutateWallet(
    { userId, type: "DEPOSIT", deltaTotal: amount, amount, refType: ref?.type, refId: ref?.id },
    db,
  )
}

/** Freeze available funds (e.g. when increasing a bid lock). */
export function freeze(userId: string, amount: bigint, db: Tx, ref?: { type: string; id: string }) {
  return mutateWallet(
    { userId, type: "FREEZE", deltaFrozen: amount, amount, refType: ref?.type, refId: ref?.id },
    db,
  )
}

/** Release previously frozen funds back to available. */
export function unfreeze(userId: string, amount: bigint, db: Tx, ref?: { type: string; id: string }) {
  return mutateWallet(
    { userId, type: "UNFREEZE", deltaFrozen: -amount, amount, refType: ref?.type, refId: ref?.id },
    db,
  )
}

/**
 * Capture a purchase by converting frozen funds into a spend:
 * total -= amount AND frozen -= amount. Used when an auction is won.
 */
export function captureFrozenPurchase(
  userId: string,
  amount: bigint,
  db: Tx,
  ref?: { type: string; id: string },
) {
  return mutateWallet(
    {
      userId,
      type: "PURCHASE",
      deltaTotal: -amount,
      deltaFrozen: -amount,
      amount,
      refType: ref?.type,
      refId: ref?.id,
    },
    db,
  )
}

/** Direct purchase from available balance (flash sale / buy-now). */
export function spendAvailable(
  userId: string,
  amount: bigint,
  db: Tx,
  ref?: { type: string; id: string },
) {
  return mutateWallet(
    { userId, type: "PURCHASE", deltaTotal: -amount, amount, refType: ref?.type, refId: ref?.id },
    db,
  )
}

/** Refund a previously captured purchase (e.g. delivery rollback). */
export function refund(userId: string, amount: bigint, db: Tx, ref?: { type: string; id: string }) {
  return mutateWallet(
    { userId, type: "REFUND", deltaTotal: amount, amount, refType: ref?.type, refId: ref?.id },
    db,
  )
}

/** Credit purchase cashback to the buyer's wallet. */
export function creditCashback(
  userId: string,
  amount: bigint,
  db: Tx,
  ref?: { type: string; id: string },
) {
  return mutateWallet(
    { userId, type: "CASHBACK", deltaTotal: amount, amount, refType: ref?.type, refId: ref?.id },
    db,
  )
}

/** Credit a referral bonus to either the inviter or the new user. */
export function creditReferralBonus(
  userId: string,
  amount: bigint,
  db: Tx,
  ref?: { type: string; id: string },
) {
  return mutateWallet(
    { userId, type: "REFERRAL_BONUS", deltaTotal: amount, amount, refType: ref?.type, refId: ref?.id },
    db,
  )
}
