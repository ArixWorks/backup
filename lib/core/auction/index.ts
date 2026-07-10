/**
 * Smart Auction Engine — foundation barrel.
 *
 * Shared services extended (not duplicated) from the existing auction system:
 * - policy   → AuctionPolicyService (global + per-auction config)
 * - pricing  → AuctionPricingEngine (tiered increments, next bid, smart Buy Now)
 * - lifecycle→ AuctionLifecycleEngine (status + real-time timer states)
 * - events   → AuctionEventService (transparent activity timeline)
 * - winner   → AuctionWinnerEngine (authoritative winner, legacy-safe fallback)
 *
 * Bid placement, wallet freeze and settlement still live in `lib/core/auction.ts`
 * and call into these services — no parallel auction module is introduced.
 */

export * from "./types"
export * from "./policy"
export * from "./pricing"
export * from "./lifecycle"
export * from "./events"
export * from "./winner"
