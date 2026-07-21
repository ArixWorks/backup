import "server-only"
import { prisma } from "@/lib/db"
import { RATE_SCALE } from "./currencies"
import { getSetting, setSettings, toBool, toNumber, SETTING_KEYS } from "./settings"
import { setUsdRate } from "@/lib/telegram/settings"

/**
 * Live foreign-exchange sync from Wallex (https://api.wallex.ir/v1/markets).
 *
 * Business rules (fixed by the product owner):
 *  - The "dollar" rate is driven purely by the USDT/Toman market (`USDTTMN`),
 *    since Wallex lists no fiat-USD pair. USD and USDT therefore share a price.
 *  - The "TON" rate is driven by the `GRAMTMN` market (Wallex lists Toncoin
 *    under its legacy `GRAM` symbol).
 *  - We always read the **24h high price** (`stats["24h_highPrice"]`).
 *  - A fixed buffer (default 2,000 Toman) is ADDED per 1 whole unit of each
 *    currency to absorb intraday volatility. Example: a raw 190,465 Toman/USDT
 *    high price is stored as 192,465 Toman.
 *
 * The computed Toman prices are written into the append-only `ExchangeRate`
 * table (latest row per pair wins, matching `getRate`) so every deposit/
 * conversion path picks them up automatically, and the display `usdRate`
 * (Toman per 1 USD, used to render balances/prices for non-Persian locales) is
 * refreshed in lock-step.
 */

export const WALLEX_MARKETS_URL = "https://api.wallex.ir/v1/markets"

/** Wallex market symbols we depend on. */
const USD_SYMBOL = "USDTTMN" // تتر / تومان  → drives the dollar rate
const TON_SYMBOL = "GRAMTMN" // گرام (TON) / تومان → drives the TON rate

/** Stats field to read the price from. */
const PRICE_FIELD = "24h_highPrice"

/** Fallbacks used only when the corresponding setting is unset/invalid. */
const DEFAULT_BUFFER_TOMAN = 2000
const DEFAULT_INTERVAL_MINUTES = 60

const FETCH_TIMEOUT_MS = 15_000

export interface WallexHighPrices {
  /** Raw 24h-high Toman price for 1 USDT (dollar), before buffer. */
  usdtToman: number
  /** Raw 24h-high Toman price for 1 TON (GRAM), before buffer. */
  tonToman: number
}

export interface WallexSyncResult {
  ran: boolean
  reason?: string
  /** Buffered Toman price stored for 1 USD/USDT. */
  usdToman?: number
  /** Buffered Toman price stored for 1 TON. */
  tonToman?: number
  bufferToman?: number
  syncedAt?: string
}

/** Read a positive numeric 24h-high price from a Wallex symbol entry. */
function readHighPrice(symbol: unknown, symbolCode: string): number {
  const stats = (symbol as { stats?: Record<string, unknown> } | undefined)?.stats
  const raw = stats?.[PRICE_FIELD]
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Wallex: missing/invalid ${PRICE_FIELD} for ${symbolCode}`)
  }
  return n
}

/** Fetch the latest 24h-high Toman prices for the USDT and GRAM (TON) markets. */
export async function fetchWallexHighPrices(): Promise<WallexHighPrices> {
  const res = await fetch(WALLEX_MARKETS_URL, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Wallex: HTTP ${res.status}`)
  const json = (await res.json()) as { result?: { symbols?: Record<string, unknown> } }
  const symbols = json?.result?.symbols
  if (!symbols || typeof symbols !== "object") {
    throw new Error("Wallex: unexpected response shape (no result.symbols)")
  }
  const usdtToman = readHighPrice(symbols[USD_SYMBOL], USD_SYMBOL)
  const tonToman = readHighPrice(symbols[TON_SYMBOL], TON_SYMBOL)
  return { usdtToman, tonToman }
}

/**
 * Fixed-point rate (×1e8) converting ONE minor unit of a 2-decimal currency
 * (USD/USDT/TON, i.e. 1 cent) into IRT minor units (Toman).
 *   1 cent = tomanPerUnit/100 Toman ⇒ rate = tomanPerUnit/100 × 1e8 = tomanPerUnit × 1e6.
 */
function centToTomanRate(tomanPerUnit: number): bigint {
  return BigInt(Math.round(tomanPerUnit)) * 1_000_000n
}

/**
 * Fixed-point rate (×1e8) converting 1 Toman (IRT minor) into minor units of a
 * 2-decimal currency (cents).
 *   1 Toman = 100/tomanPerUnit cents ⇒ rate = 100/tomanPerUnit × 1e8 = 1e10 / tomanPerUnit.
 */
function tomanToCentRate(tomanPerUnit: number): bigint {
  return 10_000_000_000n / BigInt(Math.round(tomanPerUnit))
}

/**
 * Replace the live rate for a pair with a single fresh row. We create the new
 * row first, then delete older rows for the same pair, so a concurrent
 * `getRate` (which reads the newest row) never observes a gap.
 */
async function writeRate(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  from: string,
  to: string,
  rate: bigint,
): Promise<void> {
  if (rate <= 0n) return
  const created = await tx.exchangeRate.create({ data: { baseCode: from, quoteCode: to, rate } })
  await tx.exchangeRate.deleteMany({
    where: { baseCode: from, quoteCode: to, id: { not: created.id } },
  })
}

/**
 * Compute buffered Toman prices from raw Wallex highs and persist:
 *  - ExchangeRate rows for IRT↔USD, IRT↔USDT, IRT↔TON, USD↔USDT, USD↔TON
 *  - the display `usdRate` (Toman per 1 USD)
 *  - a status snapshot in the Setting table
 */
export async function applyWallexRates(
  prices: WallexHighPrices,
  bufferToman: number,
): Promise<{ usdToman: number; tonToman: number }> {
  const buffer = Number.isFinite(bufferToman) && bufferToman >= 0 ? Math.round(bufferToman) : DEFAULT_BUFFER_TOMAN
  const usdToman = Math.round(prices.usdtToman) + buffer
  const tonToman = Math.round(prices.tonToman) + buffer

  const usdIrt = centToTomanRate(usdToman)
  const irtUsd = tomanToCentRate(usdToman)
  const tonIrt = centToTomanRate(tonToman)
  const irtTon = tomanToCentRate(tonToman)
  // TON↔USD cross rate (both 2-decimal ⇒ 1 TON-cent = tonToman/usdToman USD-cents).
  const tonUsd = (BigInt(usdToman) > 0n ? (BigInt(tonToman) * RATE_SCALE) / BigInt(usdToman) : 0n)
  const usdTon = (BigInt(tonToman) > 0n ? (BigInt(usdToman) * RATE_SCALE) / BigInt(tonToman) : 0n)

  await prisma.$transaction(async (tx) => {
    // USD (fiat) and USDT share the dollar price.
    await writeRate(tx, "USD", "IRT", usdIrt)
    await writeRate(tx, "IRT", "USD", irtUsd)
    await writeRate(tx, "USDT", "IRT", usdIrt)
    await writeRate(tx, "IRT", "USDT", irtUsd)
    await writeRate(tx, "USD", "USDT", RATE_SCALE)
    await writeRate(tx, "USDT", "USD", RATE_SCALE)
    // TON.
    await writeRate(tx, "TON", "IRT", tonIrt)
    await writeRate(tx, "IRT", "TON", irtTon)
    await writeRate(tx, "TON", "USD", tonUsd)
    await writeRate(tx, "USD", "TON", usdTon)
  })

  // Refresh the display USD rate (Toman per 1 USD) used by formatPrice().
  await setUsdRate(usdToman).catch(() => {})

  return { usdToman, tonToman }
}

/** Force a sync now (used by the hourly gate and the admin "sync now" action). */
export async function syncWallexRates(): Promise<WallexSyncResult> {
  const bufferToman = toNumber(await getSetting(SETTING_KEYS.wallexBufferToman), DEFAULT_BUFFER_TOMAN)
  try {
    const prices = await fetchWallexHighPrices()
    const { usdToman, tonToman } = await applyWallexRates(prices, bufferToman)
    const syncedAt = new Date().toISOString()
    await setSettings({
      [SETTING_KEYS.wallexLastSyncAt]: String(Date.now()),
      [SETTING_KEYS.wallexUsdToman]: String(usdToman),
      [SETTING_KEYS.wallexTonToman]: String(tonToman),
      [SETTING_KEYS.wallexLastError]: "",
    })
    return { ran: true, usdToman, tonToman, bufferToman, syncedAt }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await setSettings({ [SETTING_KEYS.wallexLastError]: message }).catch(() => {})
    return { ran: false, reason: message }
  }
}

/**
 * Cron entry point: sync only when enabled AND at least the configured interval
 * (default 60 min) has elapsed since the last successful sync. Best-effort — a
 * Wallex outage records the error and leaves the previous rates in place.
 */
export async function maybeSyncWallexRates(): Promise<WallexSyncResult> {
  const enabled = toBool(await getSetting(SETTING_KEYS.wallexEnabled))
  if (!enabled) return { ran: false, reason: "disabled" }

  const intervalMinutes = toNumber(
    await getSetting(SETTING_KEYS.wallexIntervalMinutes),
    DEFAULT_INTERVAL_MINUTES,
  )
  const intervalMs = Math.max(1, intervalMinutes) * 60_000
  const lastSyncAt = toNumber(await getSetting(SETTING_KEYS.wallexLastSyncAt), 0)
  if (lastSyncAt > 0 && Date.now() - lastSyncAt < intervalMs) {
    return { ran: false, reason: "interval-not-elapsed" }
  }
  return syncWallexRates()
}

export interface WallexStatus {
  enabled: boolean
  bufferToman: number
  intervalMinutes: number
  lastSyncAt: string | null
  usdToman: number | null
  tonToman: number | null
  lastError: string | null
}

/** Current sync configuration + last snapshot for the admin panel. */
export async function getWallexStatus(): Promise<WallexStatus> {
  const [enabled, buffer, interval, lastSyncAt, usdToman, tonToman, lastError] = await Promise.all([
    getSetting(SETTING_KEYS.wallexEnabled),
    getSetting(SETTING_KEYS.wallexBufferToman),
    getSetting(SETTING_KEYS.wallexIntervalMinutes),
    getSetting(SETTING_KEYS.wallexLastSyncAt),
    getSetting(SETTING_KEYS.wallexUsdToman),
    getSetting(SETTING_KEYS.wallexTonToman),
    getSetting(SETTING_KEYS.wallexLastError),
  ])
  const lastMs = toNumber(lastSyncAt, 0)
  return {
    enabled: toBool(enabled),
    bufferToman: toNumber(buffer, DEFAULT_BUFFER_TOMAN),
    intervalMinutes: toNumber(interval, DEFAULT_INTERVAL_MINUTES),
    lastSyncAt: lastMs > 0 ? new Date(lastMs).toISOString() : null,
    usdToman: usdToman ? toNumber(usdToman) : null,
    tonToman: tonToman ? toNumber(tonToman) : null,
    lastError: lastError || null,
  }
}
