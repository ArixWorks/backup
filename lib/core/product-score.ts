/**
 * Product score — a single 0–5 star value derived from real engagement signals
 * so the product page can show a trustworthy rating even before it accumulates
 * many written reviews.
 *
 * Signals blended:
 *  - Satisfaction: the average written-review rating (primary signal).
 *  - Purchases: real sold units (demand / proven value).
 *  - Favorites: how many users saved the product (strong intent signal).
 *
 * The satisfaction term is Bayesian-smoothed toward a neutral-positive prior so
 * a single 1★ or 5★ review can't swing the score to an extreme. Purchases and
 * favorites add a small, log-scaled and capped popularity bonus so a popular
 * product edges ahead of an identical-quality but unknown one, without letting
 * volume alone fake a high quality score.
 *
 * Pure and deterministic — safe to run on the server or the client.
 */

export interface ProductScoreInput {
  ratingAvg?: number | null
  ratingCount?: number | null
  soldCount?: number | null
  favoritesCount?: number | null
}

export interface ProductScore {
  /** Rounded to one decimal, e.g. 4.8. */
  score: number
  /** False when there is no engagement at all (hide the rating in that case). */
  hasSignal: boolean
}

// Neutral-positive prior: an unrated product starts life around here and the
// real ratings pull it away as they accumulate.
const PRIOR_MEAN = 4.3
const PRIOR_WEIGHT = 6
// Popularity can only ever nudge the score by at most this much.
const MAX_POPULARITY_BONUS = 0.6

export function computeProductScore(input: ProductScoreInput): ProductScore {
  const ratingAvg = Math.max(0, Math.min(5, input.ratingAvg ?? 0))
  const ratingCount = Math.max(0, input.ratingCount ?? 0)
  const soldCount = Math.max(0, input.soldCount ?? 0)
  const favoritesCount = Math.max(0, input.favoritesCount ?? 0)

  const satisfaction =
    (ratingAvg * ratingCount + PRIOR_MEAN * PRIOR_WEIGHT) / (ratingCount + PRIOR_WEIGHT)

  // Favorites weigh 2x a sale as an intent signal; log10 keeps the curve gentle.
  const popularity = Math.log10(1 + soldCount + favoritesCount * 2)
  const popularityBonus = Math.min(MAX_POPULARITY_BONUS, popularity * 0.15)

  const raw = Math.min(5, Math.max(0, satisfaction + popularityBonus))
  return {
    score: Math.round(raw * 10) / 10,
    hasSignal: ratingCount > 0 || soldCount > 0 || favoritesCount > 0,
  }
}
