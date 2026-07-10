/**
 * AuctionPricingEngine — pure, policy-driven pricing math. No DB, no I/O, so it
 * is trivially testable and safe to run on both server and client (the bid
 * panel can compute the same next-bid / Buy Now values the server enforces).
 *
 * Responsibilities:
 * - Tiered (or fixed) minimum increment for a given price.
 * - Next minimum valid bid.
 * - Adaptive quick-bid amounts.
 * - Smart Buy Now price + availability per Buy Now strategy (Phase 3).
 *
 * Smart Buy Now guarantee (fixes Problem 1 — Buy Now must never sit below the
 * live market value the auction has produced):
 *
 *   smartBuyNow = max(
 *     initialBuyNowPrice,
 *     nextMinimumBid + safetyMargin,
 *     currentBid * (1 + buyNowPremiumPercent),
 *     reservePrice (when reserve applies)
 *   )
 */

import type { AuctionPolicy, AuctionPricing } from "./types"

function maxBig(...vals: bigint[]): bigint {
  return vals.reduce((a, b) => (b > a ? b : a))
}

/** Minimum increment for a price under the policy's strategy. */
export function incrementForPrice(price: bigint, policy: AuctionPolicy): bigint {
  if (policy.bidIncrementStrategy === "FIXED") {
    const first = policy.minimumIncrementRules[0]?.increment ?? 1000
    return BigInt(Math.max(1, first))
  }
  // TIERED: first rule whose (exclusive) upper bound is above the price.
  for (const tier of policy.minimumIncrementRules) {
    if (tier.upTo === null || price < BigInt(tier.upTo)) {
      return BigInt(Math.max(1, tier.increment))
    }
  }
  const last = policy.minimumIncrementRules[policy.minimumIncrementRules.length - 1]
  return BigInt(Math.max(1, last?.increment ?? 1000))
}

/** Next minimum valid bid given the current price and whether bids exist. */
export function nextMinimumBid(
  opts: { startPrice: bigint; currentPrice: bigint; hasBids: boolean },
  policy: AuctionPolicy,
): bigint {
  if (!opts.hasBids) return opts.startPrice
  return opts.currentPrice + incrementForPrice(opts.currentPrice, policy)
}

/** Adaptive quick-bid amounts (+1x, +2x, +5x increment), ascending & de-duped. */
export function quickBidAmounts(
  opts: { startPrice: bigint; currentPrice: bigint; hasBids: boolean },
  policy: AuctionPolicy,
): bigint[] {
  const base = nextMinimumBid(opts, policy)
  const inc = incrementForPrice(opts.hasBids ? opts.currentPrice : opts.startPrice, policy)
  const amounts = [base, base + inc, base + inc * 4n]
  return Array.from(new Set(amounts.map((a) => a.toString())))
    .map((s) => BigInt(s))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * Smart Buy Now price + availability. `initialBuyNowPrice` is the admin's
 * configured Buy Now (or null when never set). Returns `{ price: null }` when
 * Buy Now is not offered for the current state under the active strategy.
 */
export function smartBuyNowPrice(
  opts: {
    startPrice: bigint
    currentPrice: bigint
    hasBids: boolean
    initialBuyNowPrice: bigint | null
    reservePrice: bigint | null
  },
  policy: AuctionPolicy,
): { price: bigint | null; available: boolean } {
  const strategy = policy.buyNowStrategy
  if (strategy === "DISABLED" || opts.initialBuyNowPrice === null || !policy.smartBuyNowEnabled) {
    // When smart pricing is off entirely, fall back to the static configured
    // price (legacy behaviour) if one exists and strategy isn't DISABLED.
    if (!policy.smartBuyNowEnabled && strategy !== "DISABLED" && opts.initialBuyNowPrice !== null) {
      return { price: opts.initialBuyNowPrice, available: true }
    }
    return { price: null, available: false }
  }

  const base = opts.initialBuyNowPrice

  // FIXED_UNTIL_FIRST_BID: static price until the first bid, then withdrawn.
  if (strategy === "FIXED_UNTIL_FIRST_BID") {
    return opts.hasBids ? { price: null, available: false } : { price: base, available: true }
  }

  // Threshold, expressed as a fraction of the configured Buy Now price.
  const thresholdValue = (base * BigInt(policy.buyNowDisableThresholdPercent)) / 100n
  const overThreshold = opts.hasBids && opts.currentPrice >= thresholdValue

  if (strategy === "FIXED_UNTIL_THRESHOLD") {
    if (overThreshold) return { price: null, available: false }
    return { price: base, available: true }
  }

  // Dynamic smart price (used by DYNAMIC_SMART_PRICE and, pre-threshold, by
  // AUTO_DISABLE_AFTER_THRESHOLD).
  const inc = incrementForPrice(opts.currentPrice, policy)
  const safetyMargin = inc * BigInt(policy.buyNowMinimumGapFromNextBid)
  const nextMin = nextMinimumBid(opts, policy)
  const premiumFloor = (opts.currentPrice * BigInt(100 + policy.buyNowPremiumPercent)) / 100n

  const candidates = [base, nextMin + safetyMargin]
  if (opts.hasBids) candidates.push(premiumFloor)
  if (opts.reservePrice !== null && policy.reservePriceEnabled) candidates.push(opts.reservePrice)
  const smart = maxBig(...candidates)

  if (strategy === "AUTO_DISABLE_AFTER_THRESHOLD" && overThreshold) {
    return { price: null, available: false }
  }
  return { price: smart, available: true }
}

/** Full pricing snapshot for an auction row. Pure — pass the resolved policy. */
export function computePricing(
  opts: {
    startPrice: bigint
    currentPrice: bigint
    hasBids: boolean
    initialBuyNowPrice: bigint | null
    reservePrice: bigint | null
  },
  policy: AuctionPolicy,
): AuctionPricing {
  const currentBid = opts.hasBids ? opts.currentPrice : opts.startPrice
  const minimumIncrement = incrementForPrice(currentBid, policy)
  const next = nextMinimumBid(opts, policy)
  const quickBids = quickBidAmounts(opts, policy)
  const buyNow = smartBuyNowPrice(opts, policy)
  const reservePrice = policy.reservePriceEnabled ? opts.reservePrice : null
  const reserveMet = reservePrice === null ? true : currentBid >= reservePrice

  return {
    hasBids: opts.hasBids,
    currentBid,
    minimumIncrement,
    nextMinimumBid: next,
    quickBids,
    buyNowPrice: buyNow.price,
    buyNowAvailable: buyNow.available,
    reservePrice,
    reserveMet,
  }
}

/**
 * Server-side guard used by the bid/Buy-Now flow: validate a Buy Now purchase
 * amount against the smart price. Prevents buying below live market value.
 */
export function assertBuyNowAllowed(
  opts: {
    startPrice: bigint
    currentPrice: bigint
    hasBids: boolean
    initialBuyNowPrice: bigint | null
    reservePrice: bigint | null
  },
  policy: AuctionPolicy,
): { allowed: boolean; price: bigint | null; reason?: string } {
  const { price, available } = smartBuyNowPrice(opts, policy)
  if (!available || price === null) {
    return { allowed: false, price: null, reason: "BUY_NOW_UNAVAILABLE" }
  }
  const next = nextMinimumBid(opts, policy)
  if (price < next) {
    // Should never happen (smart price >= next+margin), but guard anyway.
    return { allowed: false, price, reason: "BELOW_NEXT_MIN_BID" }
  }
  return { allowed: true, price }
}
