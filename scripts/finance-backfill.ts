/**
 * Go-live backfill for the double-entry ledger + multi-currency support.
 *
 * Safe and idempotent: it seeds currencies/rates/system accounts, then posts a
 * one-time "opening balance" entry for every existing wallet so the ledger
 * immediately matches the cached wallet balances. Re-running it is a no-op for
 * wallets that already have their opening entry.
 *
 * Run with: tsx scripts/finance-backfill.ts
 */
import { PrismaClient, type Prisma, type LedgerAccountKind } from "@prisma/client"
import { randomBytes } from "crypto"

const prisma = new PrismaClient()
type Tx = Prisma.TransactionClient

const RATE_SCALE = 100_000_000n

const CURRENCIES = [
  { code: "IRT", name: "تومان", symbol: "تومان", decimals: 0, isBase: true, displayOrder: 0 },
  { code: "USD", name: "دلار آمریکا", symbol: "$", decimals: 2, isBase: false, displayOrder: 1 },
  { code: "USDT", name: "تتر", symbol: "₮", decimals: 2, isBase: false, displayOrder: 2 },
]

const RATES = [
  { from: "USD", to: "IRT", rate: 700n * RATE_SCALE },
  { from: "IRT", to: "USD", rate: 142857n },
  { from: "USDT", to: "IRT", rate: 700n * RATE_SCALE },
  { from: "IRT", to: "USDT", rate: 142857n },
  { from: "USD", to: "USDT", rate: RATE_SCALE },
  { from: "USDT", to: "USD", rate: RATE_SCALE },
]

function slug(prefix: string) {
  return `${prefix}-${randomBytes(12).toString("base64url")}`
}

async function getOrCreateAccount(
  tx: Tx,
  kind: LedgerAccountKind,
  currency: string,
  ownerUserId: string | null,
) {
  const existing = await tx.ledgerAccount.findFirst({ where: { kind, ownerUserId, currency } })
  if (existing) return existing
  return tx.ledgerAccount.create({ data: { kind, ownerUserId, currency } })
}

async function main() {
  console.log("[backfill] seeding currencies...")
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({ where: { code: c.code }, create: c, update: c })
  }

  console.log("[backfill] seeding exchange rates...")
  for (const r of RATES) {
    const exists = await prisma.exchangeRate.findFirst({
      where: { baseCode: r.from, quoteCode: r.to },
    })
    if (!exists) {
      await prisma.exchangeRate.create({ data: { baseCode: r.from, quoteCode: r.to, rate: r.rate } })
    }
  }

  const wallets = await prisma.wallet.findMany()
  console.log(`[backfill] found ${wallets.length} wallet(s); posting opening balances...`)

  let posted = 0
  let skipped = 0
  for (const w of wallets) {
    const refId = `${w.userId}:${w.currency}`
    await prisma.$transaction(async (tx) => {
      // Idempotency: skip if this wallet already has an opening entry.
      const already = await tx.ledgerEntry.findFirst({
        where: { refType: "opening", refId },
      })
      if (already) {
        skipped++
        return
      }

      const available = w.totalBalance - w.frozenBalance
      const frozen = w.frozenBalance
      const total = w.totalBalance

      const entry = await tx.ledgerEntry.create({
        data: {
          publicId: slug("led"),
          kind: "ADMIN_ADJUSTMENT",
          currency: w.currency,
          refType: "opening",
          refId,
          memo: "Opening balance (ledger go-live backfill)",
        },
      })

      const legs: Array<{ kind: LedgerAccountKind; owner: string | null; amount: bigint }> = [
        { kind: "USER_AVAILABLE", owner: w.userId, amount: available },
        { kind: "USER_FROZEN", owner: w.userId, amount: frozen },
        { kind: "SYS_OPENING_BALANCE", owner: null, amount: -total },
      ]

      for (const leg of legs) {
        // Always create the user accounts (even at zero) so reconciliation can
        // find them; skip only the zero-amount system leg's balance change.
        const account = await getOrCreateAccount(tx, leg.kind, w.currency, leg.owner)
        if (leg.amount === 0n && leg.kind === "SYS_OPENING_BALANCE") continue
        const nextBalance = account.balance + leg.amount
        await tx.ledgerAccount.update({
          where: { id: account.id },
          data: { balance: nextBalance, version: { increment: 1 } },
        })
        await tx.ledgerLeg.create({
          data: { entryId: entry.id, accountId: account.id, amount: leg.amount, balanceAfter: nextBalance },
        })
      }
      posted++
    })
  }

  // Verify zero-sum per currency.
  const currencies = [...new Set(wallets.map((w) => w.currency))]
  for (const cur of currencies) {
    const accounts = await prisma.ledgerAccount.findMany({ where: { currency: cur } })
    const residual = accounts.reduce((acc, a) => acc + a.balance, 0n)
    console.log(`[backfill] zero-sum ${cur}: residual=${residual.toString()} ${residual === 0n ? "OK" : "MISMATCH"}`)
  }

  console.log(`[backfill] done. posted=${posted} skipped=${skipped}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
