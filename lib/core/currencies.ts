import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { BASE_CURRENCY } from "./ledger"

type Tx = Prisma.TransactionClient

/** Fixed-point scale for exchange rates (rate is stored as an integer ×1e8). */
export const RATE_SCALE = 100_000_000n

export interface CurrencySeed {
  code: string
  name: string
  symbol: string
  decimals: number
  isBase: boolean
  displayOrder: number
}

/**
 * Supported currencies. IRT is the base (0 decimals — amounts are whole Toman).
 * USD/USDT use 2 decimals. Amounts are always stored as BigInt minor units.
 */
export const DEFAULT_CURRENCIES: CurrencySeed[] = [
  { code: "IRT", name: "تومان", symbol: "تومان", decimals: 0, isBase: true, displayOrder: 0 },
  { code: "USD", name: "دلار آمریکا", symbol: "$", decimals: 2, isBase: false, displayOrder: 1 },
  { code: "USDT", name: "تتر", symbol: "₮", decimals: 2, isBase: false, displayOrder: 2 },
  { code: "TON", name: "تون", symbol: "TON", decimals: 2, isBase: false, displayOrder: 3 },
]

/**
 * Initial demo exchange rates, expressed as the multiplier that converts ONE
 * minor unit of `from` into minor units of `to`, scaled ×1e8. Admins can update
 * these from the finance dashboard; the latest row per pair wins.
 *   1 USD ≈ 70,000 IRT  ⇒  1 cent (USD minor) = 700 Toman ⇒ rate 700×1e8
 *   1 Toman = 1/700 cent ⇒ rate ≈ 142857 (×1e8 scaled)
 */
const INITIAL_RATES: Array<{ from: string; to: string; rate: bigint }> = [
  { from: "USD", to: "IRT", rate: 700n * RATE_SCALE },
  { from: "IRT", to: "USD", rate: 142857n },
  { from: "USDT", to: "IRT", rate: 700n * RATE_SCALE },
  { from: "IRT", to: "USDT", rate: 142857n },
  { from: "USD", to: "USDT", rate: RATE_SCALE },
  { from: "USDT", to: "USD", rate: RATE_SCALE },
  // 1 TON ≈ $5 ⇒ 1 TON minor (cent) = 5 USD cents ⇒ rate 5×1e8.
  { from: "TON", to: "USD", rate: 5n * RATE_SCALE },
  { from: "USD", to: "TON", rate: RATE_SCALE / 5n },
  // 1 TON ≈ 350,000 IRT ⇒ 1 TON cent = 3,500 Toman ⇒ rate 3500×1e8.
  { from: "TON", to: "IRT", rate: 3_500n * RATE_SCALE },
  { from: "IRT", to: "TON", rate: RATE_SCALE / 3_500n },
]

/** Idempotently upsert the supported currencies. */
export async function seedCurrencies(db: Tx = prisma) {
  for (const c of DEFAULT_CURRENCIES) {
    await db.currency.upsert({
      where: { code: c.code },
      create: c,
      update: { name: c.name, symbol: c.symbol, decimals: c.decimals, isBase: c.isBase, displayOrder: c.displayOrder },
    })
  }
}

/** Seed initial exchange rates only if a pair has no rate yet. */
export async function seedInitialRates(db: Tx = prisma) {
  for (const r of INITIAL_RATES) {
    const existing = await db.exchangeRate.findFirst({
      where: { baseCode: r.from, quoteCode: r.to },
      orderBy: { createdAt: "desc" },
    })
    if (!existing) {
      await db.exchangeRate.create({ data: { baseCode: r.from, quoteCode: r.to, rate: r.rate } })
    }
  }
}

export async function listCurrencies(db: Tx = prisma) {
  return db.currency.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" } })
}

/** Latest rate (×1e8) converting one minor unit of `from` into `to`. */
export async function getRate(from: string, to: string, db: Tx = prisma): Promise<bigint | null> {
  if (from === to) return RATE_SCALE
  const row = await db.exchangeRate.findFirst({
    where: { baseCode: from, quoteCode: to },
    orderBy: { createdAt: "desc" },
  })
  return row?.rate ?? null
}

/** Record a new rate (admin action). */
export async function setRate(from: string, to: string, rate: bigint, updatedById?: string, db: Tx = prisma) {
  return db.exchangeRate.create({ data: { baseCode: from, quoteCode: to, rate, updatedById } })
}

export { BASE_CURRENCY }
