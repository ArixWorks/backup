import type { Prisma, WalletTxType, LedgerAccountKind } from "@prisma/client"
import { prisma } from "@/lib/db"
import { secureSlug } from "@/lib/id"
import { ConflictError, ValidationError } from "./errors"

type Tx = Prisma.TransactionClient

/** The single base currency. Every existing money path operates in IRT. */
export const BASE_CURRENCY = "IRT"

/**
 * True when an error is a *transient write conflict* that is safe to retry by
 * re-running the whole transaction:
 *  - our optimistic ledger-account version guard (`postEntry`),
 *  - Prisma's serialization/write-conflict error (P2034),
 *  - Postgres serialization_failure (40001) / deadlock_detected (40P01).
 *
 * Concurrent money operations contend on shared SYSTEM accounts (SYS_REVENUE on
 * every purchase, SYS_CASH on every deposit, …). Without a retry, one of two
 * simultaneous-but-otherwise-valid operations fails with a confusing domain
 * error. These conflicts are genuinely transient, so retrying resolves them.
 */
function isRetryableTxConflict(err: unknown): boolean {
  if (err instanceof ConflictError && /modified concurrently/i.test(err.message)) return true
  const code = (err as { code?: string })?.code
  if (code === "P2034") return true // Prisma: write conflict / deadlock, retry
  const pg = (err as { meta?: { code?: string } })?.meta?.code
  if (pg === "40001" || pg === "40P01") return true
  if (typeof (err as { message?: string })?.message === "string") {
    return /could not serialize access|deadlock detected|write conflict/i.test((err as Error).message)
  }
  return false
}

/**
 * Run a money-mutating transaction at SERIALIZABLE isolation with bounded retry
 * on transient write conflicts. Because every read inside `fn` (including the
 * ledger-account version reads in `postEntry`) re-executes on each attempt,
 * re-running the whole transaction is correct: the conflicting operation simply
 * recomputes against fresh state. Non-conflict errors propagate immediately.
 */
export async function serializableTx<T>(
  fn: (tx: Tx) => Promise<T>,
  opts: { attempts?: number; label?: string } = {},
): Promise<T> {
  // PostgreSQL SERIALIZABLE *requires* callers to retry serialization failures.
  // Hot shared accounts (SYS_CASH on every deposit, SYS_REVENUE on every
  // purchase) can have many transactions contending at once, so the budget must
  // be generous: 12 attempts with FULL-JITTER exponential backoff. Full jitter
  // (delay = random[0, cap]) de-synchronizes a thundering herd far better than a
  // fixed delay, so contenders stop colliding on the same retry boundary.
  const attempts = opts.attempts ?? 12
  let lastErr: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: "Serializable" })
    } catch (err) {
      lastErr = err
      if (!isRetryableTxConflict(err) || attempt === attempts) throw err
      // Full jitter: exponentially growing cap (20ms → ~640ms), random within it.
      const cap = Math.min(640, 20 * 2 ** (attempt - 1))
      const delay = Math.floor(Math.random() * cap) + 5
      if (opts.label) {
        console.log(`[v0] tx conflict on ${opts.label}, retry ${attempt}/${attempts} in ${delay}ms`)
      }
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

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
 * ownerUserId; SYS_* accounts are global (ownerUserId = null). SYS_* accounts
 * are seeded up front, so in practice the create path is only hit the first
 * time a given user transacts in a currency.
 *
 * Concurrency correctness — this MUST stay on the caller's transaction `db`
 * (single connection). Two earlier approaches were wrong:
 *   1. Original: `create` then, on failure, `findFirst` again on the SAME tx.
 *      In Postgres a failed statement aborts the whole transaction, so the
 *      recovery query fails with `25P02 current transaction is aborted` and
 *      corrupted concurrent money operations.
 *   2. Out-of-band create on the top-level `prisma` (separate connection) while
 *      the caller still holds its tx connection — under a concurrent burst this
 *      exhausts the connection pool and deadlocks ("Unable to start a
 *      transaction in the given time").
 *
 * Correct approach: attempt the create on the caller's own connection; if a
 * concurrent creator wins the unique-constraint race (P2002), translate it into
 * a *retryable* conflict. `postEntry`/`mutateWallet` run inside `serializableTx`,
 * which rolls back and retries the whole transaction — on the retry the row is
 * committed and visible, so this becomes a pure read. No second connection is
 * ever acquired, so the pool can't deadlock.
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
  try {
    return await db.ledgerAccount.create({ data: { kind, ownerUserId, currency } })
  } catch (err) {
    // Unique-constraint race: another tx created the same account concurrently.
    // Do NOT re-query this (now-aborted) transaction — surface a retryable
    // conflict so the enclosing serializableTx restarts cleanly.
    if ((err as { code?: string })?.code === "P2002") {
      throw new ConflictError("Ledger account modified concurrently")
    }
    throw err
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
    const ownerUserId = leg.ownerUserId ?? null

    // Apply the balance change as a BLIND ATOMIC INCREMENT *first*, before any
    // read of this row in the transaction. This is the critical concurrency
    // property: hot shared system accounts (e.g. SYS_REVENUE on every purchase)
    // would otherwise be read-then-written by every concurrent transaction,
    // creating SERIALIZABLE rw-antidependency cycles that abort under load
    // (P2034 thundering herd). A blind increment takes a row-level write lock
    // instead, so concurrent writers *wait* for each other and apply
    // sequentially rather than aborting. The increment is also relative, so the
    // result is correct regardless of interleaving.
    const inc = await db.ledgerAccount.updateMany({
      where: { kind: leg.kind, ownerUserId, currency },
      data: { balance: { increment: leg.amount }, version: { increment: 1 } },
    })
    if (inc.count === 0) {
      // First-ever use of this (account, currency): create it with the opening
      // balance. A concurrent creator that wins the unique race surfaces P2002,
      // which we translate into a retryable conflict (serializableTx restarts).
      try {
        await db.ledgerAccount.create({
          data: { kind: leg.kind, ownerUserId, currency, balance: leg.amount, version: 1 },
        })
      } catch (err) {
        if ((err as { code?: string })?.code === "P2002") {
          throw new ConflictError("Ledger account modified concurrently")
        }
        throw err
      }
    }

    // Read back the post-balance for the immutable leg snapshot. This read
    // happens AFTER our write, so we already hold the row lock — no read-write
    // race with other transactions.
    const account = await db.ledgerAccount.findFirst({
      where: { kind: leg.kind, ownerUserId, currency },
      select: { id: true, balance: true },
    })
    if (!account) throw new ConflictError("Ledger account modified concurrently")

    await db.ledgerLeg.create({
      data: { entryId: entry.id, accountId: account.id, amount: leg.amount, balanceAfter: account.balance },
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
