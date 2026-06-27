import type { Prisma, WalletTxType, LedgerAccountKind } from "@prisma/client"
import { prisma } from "@/lib/db"
import { secureSlug } from "@/lib/id"
import { withLock } from "@/lib/redis"
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
  const attempts = opts.attempts ?? 5
  let lastErr: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: "Serializable" })
    } catch (err) {
      lastErr = err
      if (!isRetryableTxConflict(err) || attempt === attempts) throw err
      // Exponential backoff with jitter to spread out contending writers.
      const delay = Math.min(200, 10 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 15)
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
 * ownerUserId; SYS_* accounts are global (ownerUserId = null).
 *
 * CRITICAL: account creation must NEVER run on the caller's transaction `db`.
 * In Postgres, once any statement in a transaction errors (a unique-constraint
 * race on `create`, or a SERIALIZABLE serialization failure), the whole
 * transaction enters the *aborted* state and every subsequent statement fails
 * with `25P02 current transaction is aborted`. The previous implementation
 * caught the failed `create` and then issued another query on the same aborted
 * tx — which corrupted concurrent money operations and could also leak duplicate
 * system accounts (NULL ownerUserId rows are "distinct" to the unique index).
 *
 * Instead we create on a separate autocommit connection (top-level `prisma`),
 * serialized by a distributed lock so concurrent callers can't create
 * duplicates. The committed row is then visible to the caller's subsequent
 * write (UPDATE/INSERT operate on the latest committed row version; if SSI flags
 * a conflict the caller's `serializableTx` simply retries).
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

  // Account missing from this tx's snapshot — create it out-of-band so a race
  // here cannot abort the caller's transaction.
  return withLock(`ledger:acct:${kind}:${ownerUserId ?? "sys"}:${currency}`, async () => {
    // Re-check on the autocommit connection inside the lock (another caller may
    // have created it between our snapshot read and acquiring the lock).
    const found = await prisma.ledgerAccount.findFirst({ where: { kind, ownerUserId, currency } })
    if (found) return found
    return prisma.ledgerAccount.create({ data: { kind, ownerUserId, currency } })
  })
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
