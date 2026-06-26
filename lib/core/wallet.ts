import type { Prisma, WalletTxType, LedgerAccountKind } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ConflictError, InsufficientFundsError, NotFoundError, ValidationError } from "./errors"
import {
  BASE_CURRENCY,
  postEntry,
  systemAccountForType,
  reconstructUserBalance,
  type LegInput,
} from "./ledger"

type Tx = Prisma.TransactionClient

export interface WalletBalances {
  totalBalance: bigint
  frozenBalance: bigint
  availableBalance: bigint
}

export interface CurrencyBalances extends WalletBalances {
  currency: string
}

/** Ensure a wallet row exists for the user in the given currency. */
export async function ensureWallet(
  userId: string,
  db: Tx = prisma,
  currency: string = BASE_CURRENCY,
): Promise<void> {
  await db.wallet.upsert({
    where: { userId_currency: { userId, currency } },
    create: { userId, currency },
    update: {},
  })
}

export async function getBalances(
  userId: string,
  db: Tx = prisma,
  currency: string = BASE_CURRENCY,
): Promise<WalletBalances> {
  const wallet = await db.wallet.findUnique({ where: { userId_currency: { userId, currency } } })
  if (!wallet) throw new NotFoundError("Wallet not found")
  return {
    totalBalance: wallet.totalBalance,
    frozenBalance: wallet.frozenBalance,
    availableBalance: wallet.totalBalance - wallet.frozenBalance,
  }
}

/** Every currency wallet a user holds (auto-includes the base currency at zero). */
export async function getAllBalances(
  userId: string,
  db: Tx = prisma,
): Promise<CurrencyBalances[]> {
  const wallets = await db.wallet.findMany({ where: { userId }, orderBy: { currency: "asc" } })
  const list = wallets.map((w) => ({
    currency: w.currency,
    totalBalance: w.totalBalance,
    frozenBalance: w.frozenBalance,
    availableBalance: w.totalBalance - w.frozenBalance,
  }))
  if (!list.some((b) => b.currency === BASE_CURRENCY)) {
    list.unshift({ currency: BASE_CURRENCY, totalBalance: 0n, frozenBalance: 0n, availableBalance: 0n })
  }
  return list
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
  /** Currency of the wallet to mutate. Defaults to the base currency. */
  currency?: string
  refType?: string
  refId?: string
  note?: string
  /** Optional override for the system counterparty account (used by conversions). */
  systemAccountKind?: LedgerAccountKind
  /** Admin id, recorded on the ledger entry when relevant. */
  createdById?: string
}

/**
 * Atomically mutate a wallet, append the immutable WalletTransaction, AND post
 * a balanced double-entry ledger record. Enforces invariants: total >= 0,
 * frozen >= 0, frozen <= total. Uses optimistic locking so concurrent mutations
 * cannot interleave. MUST be called inside a transaction.
 *
 * Ledger legs are derived mathematically from the deltas so they always balance:
 *   deltaAvailable = deltaTotal - deltaFrozen
 *   USER_AVAILABLE += deltaAvailable
 *   USER_FROZEN    += deltaFrozen
 *   SYSTEM         += -deltaTotal   (only when a system counterparty applies)
 *   sum = (deltaTotal - deltaFrozen) + deltaFrozen + (-deltaTotal) = 0
 */
export async function mutateWallet(args: MutateArgs, db: Tx): Promise<WalletBalances> {
  const { userId, type, amount, refType, refId, note } = args
  const currency = args.currency ?? BASE_CURRENCY
  const deltaTotal = args.deltaTotal ?? 0n
  const deltaFrozen = args.deltaFrozen ?? 0n

  const wallet = await db.wallet.findUnique({ where: { userId_currency: { userId, currency } } })
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

  const txRow = await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type,
      currency,
      amount,
      balanceAfter: nextTotal,
      frozenAfter: nextFrozen,
      refType,
      refId,
      note,
    },
  })

  // Post the authoritative double-entry record in the same transaction.
  const deltaAvailable = deltaTotal - deltaFrozen
  const sysKind = args.systemAccountKind ?? systemAccountForType(type)
  const legs: LegInput[] = [
    { kind: "USER_AVAILABLE", ownerUserId: userId, amount: deltaAvailable },
    { kind: "USER_FROZEN", ownerUserId: userId, amount: deltaFrozen },
  ]
  if (sysKind) {
    legs.push({ kind: sysKind, amount: -deltaTotal })
  } else if (deltaTotal !== 0n) {
    // A net change in total funds always needs a counterparty; refuse to post
    // an unbalanced entry rather than silently corrupt the ledger.
    throw new ValidationError(`No system counterparty for ${type} with non-zero total delta`)
  }
  await postEntry(db, {
    kind: type,
    currency,
    legs,
    refType,
    refId,
    memo: note,
    createdById: args.createdById,
    walletTxId: txRow.id,
  })

  return {
    totalBalance: nextTotal,
    frozenBalance: nextFrozen,
    availableBalance: nextTotal - nextFrozen,
  }
}

// --- High-level operations ---------------------------------------------------

/** Credit funds (e.g. approved deposit). */
export function deposit(
  userId: string,
  amount: bigint,
  db: Tx,
  ref?: { type: string; id: string },
  currency: string = BASE_CURRENCY,
) {
  return mutateWallet(
    { userId, type: "DEPOSIT", deltaTotal: amount, amount, refType: ref?.type, refId: ref?.id, currency },
    db,
  )
}

/** Freeze available funds (e.g. when increasing a bid lock). */
export function freeze(
  userId: string,
  amount: bigint,
  db: Tx,
  ref?: { type: string; id: string },
  currency: string = BASE_CURRENCY,
) {
  return mutateWallet(
    { userId, type: "FREEZE", deltaFrozen: amount, amount, refType: ref?.type, refId: ref?.id, currency },
    db,
  )
}

/** Release previously frozen funds back to available. */
export function unfreeze(
  userId: string,
  amount: bigint,
  db: Tx,
  ref?: { type: string; id: string },
  currency: string = BASE_CURRENCY,
) {
  return mutateWallet(
    { userId, type: "UNFREEZE", deltaFrozen: -amount, amount, refType: ref?.type, refId: ref?.id, currency },
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
  currency: string = BASE_CURRENCY,
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
      currency,
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
  currency: string = BASE_CURRENCY,
) {
  return mutateWallet(
    { userId, type: "PURCHASE", deltaTotal: -amount, amount, refType: ref?.type, refId: ref?.id, currency },
    db,
  )
}

/** Refund a previously captured purchase (e.g. delivery rollback). */
export function refund(
  userId: string,
  amount: bigint,
  db: Tx,
  ref?: { type: string; id: string },
  currency: string = BASE_CURRENCY,
) {
  return mutateWallet(
    { userId, type: "REFUND", deltaTotal: amount, amount, refType: ref?.type, refId: ref?.id, currency },
    db,
  )
}

/** Credit purchase cashback to the buyer's wallet. */
export function creditCashback(
  userId: string,
  amount: bigint,
  db: Tx,
  ref?: { type: string; id: string },
  currency: string = BASE_CURRENCY,
) {
  return mutateWallet(
    { userId, type: "CASHBACK", deltaTotal: amount, amount, refType: ref?.type, refId: ref?.id, currency },
    db,
  )
}

/** Credit a referral bonus to either the inviter or the new user. */
export function creditReferralBonus(
  userId: string,
  amount: bigint,
  db: Tx,
  ref?: { type: string; id: string },
  currency: string = BASE_CURRENCY,
) {
  return mutateWallet(
    {
      userId,
      type: "REFERRAL_BONUS",
      deltaTotal: amount,
      amount,
      refType: ref?.type,
      refId: ref?.id,
      currency,
    },
    db,
  )
}

// --- Currency conversion -----------------------------------------------------

/** Round-half-up division of scaled bigints (rate is scaled ×1e8). */
const RATE_SCALE = 100_000_000n

/**
 * Convert funds between two of a user's currency wallets at the given rate
 * (scaled ×1e8 = units of `to` per unit of `from`). Debits the source wallet
 * and credits the destination wallet, posting both legs to SYS_FX_CLEARING so
 * each single-currency entry stays balanced, then records a CurrencyConversion.
 */
export async function convertCurrency(args: {
  userId: string
  fromCurrency: string
  toCurrency: string
  fromAmount: bigint
  rate: bigint // scaled ×1e8
  db: Tx
}) {
  const { userId, fromCurrency, toCurrency, fromAmount, rate, db } = args
  if (fromCurrency === toCurrency) throw new ValidationError("Currencies must differ")
  if (fromAmount <= 0n) throw new ValidationError("Amount must be positive")

  const toAmount = (fromAmount * rate) / RATE_SCALE
  if (toAmount <= 0n) throw new ValidationError("Converted amount is too small")

  await ensureWallet(userId, db, fromCurrency)
  await ensureWallet(userId, db, toCurrency)

  // Debit source (funds leave into FX clearing for this currency).
  await mutateWallet(
    {
      userId,
      type: "CONVERSION",
      deltaTotal: -fromAmount,
      amount: fromAmount,
      currency: fromCurrency,
      systemAccountKind: "SYS_FX_CLEARING",
      refType: "conversion",
      note: `${fromCurrency}→${toCurrency}`,
    },
    db,
  )
  // Credit destination (funds arrive from FX clearing for that currency).
  await mutateWallet(
    {
      userId,
      type: "CONVERSION",
      deltaTotal: toAmount,
      amount: toAmount,
      currency: toCurrency,
      systemAccountKind: "SYS_FX_CLEARING",
      refType: "conversion",
      note: `${fromCurrency}→${toCurrency}`,
    },
    db,
  )

  const conversion = await db.currencyConversion.create({
    data: { userId, fromCode: fromCurrency, toCode: toCurrency, fromAmount, toAmount, rateUsed: rate },
  })
  return conversion
}

export { reconstructUserBalance }
