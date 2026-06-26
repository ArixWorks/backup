import { prisma } from "@/lib/db"
import { verifyZeroSum } from "./ledger"

export interface ZeroSumResult {
  currency: string
  balanced: boolean
  residual: string
}

export interface WalletMismatch {
  userId: string
  displayName: string | null
  currency: string
  /** Authoritative balances rebuilt from the ledger legs. */
  ledgerTotal: string
  ledgerFrozen: string
  /** Cached balances stored on the Wallet row. */
  walletTotal: string
  walletFrozen: string
  totalDiff: string
  frozenDiff: string
}

export interface ReconciliationReport {
  ranAt: string
  currencies: string[]
  zeroSum: ZeroSumResult[]
  walletsChecked: number
  mismatches: WalletMismatch[]
  ok: boolean
}

/**
 * Rebuild every user's balance purely from ledger legs and compare against the
 * cached Wallet row. Also verify each currency's ledger is internally
 * zero-summed. Read-only: reports discrepancies without mutating anything.
 */
export async function runReconciliation(): Promise<ReconciliationReport> {
  const currencyRows = await prisma.currency.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  })
  const currencies = currencyRows.map((c) => c.code)

  // Zero-sum check per currency (assets + liabilities + equity == 0).
  const zeroSum: ZeroSumResult[] = []
  for (const code of currencies) {
    const z = await verifyZeroSum(code)
    zeroSum.push({ currency: code, balanced: z.balanced, residual: z.residual.toString() })
  }

  // Rebuild balances: pull all user ledger accounts and index them.
  const ledgerAccounts = await prisma.ledgerAccount.findMany({
    where: { ownerUserId: { not: null }, kind: { in: ["USER_AVAILABLE", "USER_FROZEN"] } },
  })
  const ledgerMap = new Map<string, { total: bigint; frozen: bigint }>()
  for (const a of ledgerAccounts) {
    const key = `${a.ownerUserId}:${a.currency}`
    const entry = ledgerMap.get(key) ?? { total: 0n, frozen: 0n }
    if (a.kind === "USER_FROZEN") entry.frozen += a.balance
    entry.total += a.balance // both available and frozen contribute to total
    ledgerMap.set(key, entry)
  }

  // Compare against cached wallet rows.
  const wallets = await prisma.wallet.findMany({
    include: { user: { select: { displayName: true } } },
  })
  const mismatches: WalletMismatch[] = []
  for (const w of wallets) {
    const key = `${w.userId}:${w.currency}`
    const led = ledgerMap.get(key) ?? { total: 0n, frozen: 0n }
    const totalDiff = w.totalBalance - led.total
    const frozenDiff = w.frozenBalance - led.frozen
    if (totalDiff !== 0n || frozenDiff !== 0n) {
      mismatches.push({
        userId: w.userId,
        displayName: w.user?.displayName ?? null,
        currency: w.currency,
        ledgerTotal: led.total.toString(),
        ledgerFrozen: led.frozen.toString(),
        walletTotal: w.totalBalance.toString(),
        walletFrozen: w.frozenBalance.toString(),
        totalDiff: totalDiff.toString(),
        frozenDiff: frozenDiff.toString(),
      })
    }
  }

  const ok = zeroSum.every((z) => z.balanced) && mismatches.length === 0
  return {
    ranAt: new Date().toISOString(),
    currencies,
    zeroSum,
    walletsChecked: wallets.length,
    mismatches,
    ok,
  }
}
