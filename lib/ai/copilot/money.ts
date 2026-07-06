/**
 * Deterministic Toman amount parser for the AI Copilot.
 *
 * The model is unreliable at arithmetic and often drops scale words (writing
 * "۵۰" for "۵۰ هزار"). So instead of trusting a computed number, we ask the
 * model to *echo the amount exactly as the admin wrote it* (digits + any scale
 * word like «هزار»/«میلیون») and convert it here, deterministically.
 *
 * Rules (agreed with the product owner):
 *  - Scale words are always honored: «۱ میلیون» → 1000000، «۵۰ هزار» → 50000.
 *  - A bare number below SMALL_THRESHOLD (no scale word) is treated as
 *    "thousand Toman": «۵۰ تومان» → 50000. Real prices in the Iranian market
 *    are in the thousands, so «۵۰» practically means «۵۰ هزار».
 *  - A bare number at/above SMALL_THRESHOLD is taken as-is: «79000» → 79000.
 */

/** Below this, a scale-less amount is interpreted as thousands of Toman. */
const SMALL_THRESHOLD = 1000

/** Convert Persian (۰-۹) and Arabic-Indic (٠-٩) digits to Latin (0-9). */
function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const code = d.charCodeAt(0)
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0) // Persian
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660) // Arabic-Indic
    return d
  })
}

/** Scale words → multiplier. Ordered so larger units are matched first. */
const SCALE_PATTERNS: { re: RegExp; mult: number }[] = [
  { re: /(میلیارد|بیلیون|billion|\d\s*b\b)/i, mult: 1_000_000_000 },
  { re: /(میلیون|ملیون|million|\d\s*m\b)/i, mult: 1_000_000 },
  { re: /(هزار|thousand|\d\s*k\b)/i, mult: 1_000 },
]

/**
 * Parse a free-form amount (string as written, or a raw number) into an integer
 * number of Toman. Returns null when no usable amount is present.
 */
export function parseTomanAmount(input: unknown): number | null {
  if (input == null) return null

  // Raw numbers still go through the small-number rule for consistency.
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) return null
    return input < SMALL_THRESHOLD ? Math.round(input * 1000) : Math.round(input)
  }

  if (typeof input !== "string") return null

  let s = toLatinDigits(input).toLowerCase().trim()
  if (!s) return null
  // Drop thousand separators (Latin comma, Arabic thousands separator).
  s = s.replace(/[,٬]/g, "")

  const numMatch = s.match(/\d+(?:\.\d+)?/)
  if (!numMatch) return null
  const base = Number.parseFloat(numMatch[0])
  if (!Number.isFinite(base) || base <= 0) return null

  for (const { re, mult } of SCALE_PATTERNS) {
    if (re.test(s)) return Math.round(base * mult)
  }

  // No scale word: apply the small-number ×1000 rule.
  return base < SMALL_THRESHOLD ? Math.round(base * 1000) : Math.round(base)
}
