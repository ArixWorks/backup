export type SerializedPrice = number | string | bigint

function toFinitePrice(value: SerializedPrice | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null

  const price = Number(value)
  return Number.isFinite(price) && price >= 0 ? price : null
}

export function getProductDiscount(
  priceValue: SerializedPrice,
  compareAtPriceValue: SerializedPrice | null | undefined,
): { hasDiscount: boolean; percent: number; price: number; compareAtPrice: number | null } {
  const price = toFinitePrice(priceValue) ?? 0
  const compareAtPrice = toFinitePrice(compareAtPriceValue)
  const hasDiscount = compareAtPrice !== null && compareAtPrice > price && compareAtPrice > 0

  return {
    hasDiscount,
    percent: hasDiscount ? Math.round((1 - price / compareAtPrice) * 100) : 0,
    price,
    compareAtPrice,
  }
}
