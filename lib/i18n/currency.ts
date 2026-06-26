/**
 * Locale-aware price formatting. The source of truth is always an integer
 * Toman amount (BigInt-safe). For non-Persian locales we present a computed USD
 * value using an editable exchange rate (Toman per 1 USD).
 */

import { type Locale, localeCurrency } from "./locales"

/** Default Toman per 1 USD; overridden by the admin-configured rate. */
export const DEFAULT_USD_RATE = 100_000

const usdFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const tomanFaFmt = new Intl.NumberFormat("fa-IR")
const tomanEnFmt = new Intl.NumberFormat("en-US")

function toNumber(amount: bigint | number | string): number {
  return typeof amount === "number" ? amount : Number(amount)
}

/**
 * Format a Toman amount for display in the given locale.
 * - fa  -> "۱٬۵۰۰٬۰۰۰ تومان"
 * - others -> "$15.00" (toman / usdRate)
 */
export function formatPrice(
  tomanAmount: bigint | number | string,
  locale: Locale,
  usdRate: number = DEFAULT_USD_RATE,
): string {
  const toman = toNumber(tomanAmount)
  if (localeCurrency(locale) === "toman") {
    return `${tomanFaFmt.format(toman)} تومان`
  }
  const rate = usdRate > 0 ? usdRate : DEFAULT_USD_RATE
  return `$${usdFmt.format(toman / rate)}`
}

/** Same as formatPrice but without the currency word/symbol (numeric only). */
export function formatPriceValue(
  tomanAmount: bigint | number | string,
  locale: Locale,
  usdRate: number = DEFAULT_USD_RATE,
): string {
  const toman = toNumber(tomanAmount)
  if (localeCurrency(locale) === "toman") {
    return (locale === "fa" ? tomanFaFmt : tomanEnFmt).format(toman)
  }
  const rate = usdRate > 0 ? usdRate : DEFAULT_USD_RATE
  return usdFmt.format(toman / rate)
}

/** The currency word/symbol for a locale (used in labels). */
export function currencyLabel(locale: Locale): string {
  return localeCurrency(locale) === "toman" ? "تومان" : "USD"
}

const compactFractionFmtFa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 3 })
const compactFractionFmtEn = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 })

const TOMAN_UNITS = [
  { min: 1_000_000_000, suffix: "میلیارد تومان", div: 1_000_000_000 },
  { min: 1_000_000, suffix: "میلیون تومان", div: 1_000_000 },
  { min: 1_000, suffix: "هزار تومان", div: 1_000 },
] as const

/**
 * Compact price for tight spaces (e.g. the header balance pill), split into a
 * numeric `value` and a `suffix` so the two can be styled differently.
 *
 * Persian Toman uses magnitude words — هزار (10³), میلیون (10⁶), میلیارد (10⁹)
 * and همت = هزار میلیارد (10¹²). همت is only used for whole multiples of 10¹²
 * (e.g. ۵۰ همت); other trillions stay as «… میلیارد» to preserve precision
 * (e.g. ۴۹٬۹۹۹٫۹۹۷ میلیارد). Values under 1,000 are shown verbatim. Up to 3
 * decimals are kept and trailing zeros trimmed (۲۵٫۵ میلیون، ۱٫۲۵ میلیارد).
 *
 * Non-Toman locales fall back to native compact USD notation (e.g. $50M).
 */
export function formatPriceCompactParts(
  tomanAmount: bigint | number | string,
  locale: Locale,
  usdRate: number = DEFAULT_USD_RATE,
): { value: string; suffix: string } {
  const toman = toNumber(tomanAmount)

  if (localeCurrency(locale) !== "toman") {
    const rate = usdRate > 0 ? usdRate : DEFAULT_USD_RATE
    const compact = new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(toman / rate)
    return { value: `$${compact}`, suffix: "" }
  }

  const fmt = locale === "fa" ? compactFractionFmtFa : compactFractionFmtEn
  const abs = Math.abs(toman)

  if (abs < 1_000) return { value: fmt.format(toman), suffix: "تومان" }

  // همت only for clean, whole هزار-میلیارد amounts; otherwise show as میلیارد.
  if (abs >= 1_000_000_000_000 && toman % 1_000_000_000_000 === 0) {
    return { value: fmt.format(toman / 1_000_000_000_000), suffix: "همت" }
  }

  for (const unit of TOMAN_UNITS) {
    if (abs >= unit.min) return { value: fmt.format(toman / unit.div), suffix: unit.suffix }
  }
  return { value: fmt.format(toman), suffix: "تومان" }
}
