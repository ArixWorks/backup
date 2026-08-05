/**
 * Domain price math: provider USD cost -> discounted sale price -> Toman.
 *
 * USD is the source of truth because the registrar quotes dollars while the
 * storefront charges Toman. Storing only Toman would freeze each price at
 * whatever the exchange rate happened to be during import, so the catalog would
 * silently drift away from real cost every time the dollar moved. Keeping cents
 * and re-deriving Toman means the admin reasons in dollars once and Persian
 * customers always see a current number.
 *
 * All USD amounts are integer cents. `11.7 * 0.5` style float math would
 * accumulate rounding error across hundreds of TLDs and re-syncs.
 */

/** Fallback discount when neither the TLD nor the global setting specifies one. */
export const DEFAULT_MARGIN_PERCENT = 50

/** Fallback provider-cost ceiling for imports, in USD. */
export const DEFAULT_MAX_USD = 20

/** Toman prices are rounded up to a multiple of this to avoid ugly figures. */
const TOMAN_ROUNDING_STEP = 1_000

/** Provider dollars (e.g. `11.7`) -> integer cents (`1170`). */
export function usdToCents(usd: number): number {
  return Math.round(usd * 100)
}

export function centsToUsd(cents: number): number {
  return cents / 100
}

/** Clamp a discount to a sane range; a 100% discount would mean free domains. */
export function normalizeMarginPercent(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_MARGIN_PERCENT
  return Math.min(95, Math.max(0, Math.round(value)))
}

/**
 * Apply the discount: a $11.70 cost at 50% off sells for $5.85.
 * Rounds to the nearest cent and never returns 0 for a non-zero cost, so a
 * cheap TLD can't accidentally become free.
 */
export function computeSellCents(costCents: number, marginPercent: number): number {
  const margin = normalizeMarginPercent(marginPercent)
  const sell = Math.round((costCents * (100 - margin)) / 100)
  return costCents > 0 ? Math.max(1, sell) : 0
}

/**
 * Convert USD cents to Toman, rounding UP to the nearest 1,000.
 *
 * Rounding up (rather than nearest) keeps the displayed price from ever dipping
 * below the real dollar cost after conversion, and turns 584,973 into a clean
 * 585,000.
 */
export function centsToToman(cents: number, usdRate: number): bigint {
  if (!Number.isFinite(cents) || cents <= 0) return 0n
  const rate = usdRate > 0 ? usdRate : 0
  if (rate === 0) return 0n
  const raw = (cents / 100) * rate
  return BigInt(Math.ceil(raw / TOMAN_ROUNDING_STEP) * TOMAN_ROUNDING_STEP)
}

export interface DerivedTldPrice {
  costUsdCents: number
  sellUsdCents: number
  marginPercent: number
  /** Discounted sale price in Toman -> `basePriceIrt`. */
  basePriceIrt: bigint
  /** Pre-discount price in Toman -> `listPriceIrt`, for the strikethrough. */
  listPriceIrt: bigint
}

/**
 * Single place that turns a provider cost into every stored price field, so the
 * import path, the refresh path and the FX-rate recalculation can never drift
 * apart in how they compute a price.
 */
export function derivePrice(
  costCents: number,
  marginPercent: number | null | undefined,
  usdRate: number,
): DerivedTldPrice {
  const margin = normalizeMarginPercent(marginPercent)
  const sellUsdCents = computeSellCents(costCents, margin)
  return {
    costUsdCents: costCents,
    sellUsdCents,
    marginPercent: margin,
    basePriceIrt: centsToToman(sellUsdCents, usdRate),
    listPriceIrt: centsToToman(costCents, usdRate),
  }
}

/** Discount percent actually implied by two stored prices, for display badges. */
export function discountPercentFrom(
  listPriceIrt: bigint | number | null | undefined,
  basePriceIrt: bigint | number | null | undefined,
): number | null {
  if (listPriceIrt == null || basePriceIrt == null) return null
  const list = Number(listPriceIrt)
  const base = Number(basePriceIrt)
  if (!Number.isFinite(list) || !Number.isFinite(base) || list <= 0 || base <= 0) return null
  if (base >= list) return null
  return Math.round(((list - base) / list) * 100)
}
