/**
 * Money utilities. All monetary values are integer Toman stored as BigInt.
 * Never use floating point for money.
 */

export function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error("Money amounts must be whole Toman")
    }
    return BigInt(value)
  }
  return BigInt(value)
}

/** Format Toman with thousands separators, e.g. 1500000 -> "۱٬۵۰۰٬۰۰۰" friendly. */
export function formatToman(value: bigint | number | string): string {
  const n = typeof value === "bigint" ? value : BigInt(value)
  return new Intl.NumberFormat("en-US").format(n)
}

export function isPositive(value: bigint): boolean {
  return value > 0n
}
