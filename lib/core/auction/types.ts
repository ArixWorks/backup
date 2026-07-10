/**
 * Shared types + const-enums for the Smart Auction Engine foundation.
 *
 * These are the single source of truth for auction policy, pricing, lifecycle,
 * timeline events and winner results. Every downstream service (pricing,
 * lifecycle, events, winner) and the UI/AI-Copilot layers build on these — so
 * NO auction rule is hardcoded at a call site; everything flows from policy.
 *
 * Design notes:
 * - Money is `bigint` at the engine boundary (matches Prisma `BigInt` columns).
 *   Policy JSON stores plain numbers (admin-editable), coerced to bigint here.
 * - Enums are declared as `as const` unions (project convention) instead of TS
 *   `enum`, except where a Prisma enum already exists (AuctionStatus etc.).
 */

// --- Buy Now strategy --------------------------------------------------------

export const BUY_NOW_STRATEGIES = [
  "DISABLED",
  "FIXED_UNTIL_FIRST_BID",
  "FIXED_UNTIL_THRESHOLD",
  "DYNAMIC_SMART_PRICE",
  "AUTO_DISABLE_AFTER_THRESHOLD",
] as const
export type BuyNowStrategy = (typeof BUY_NOW_STRATEGIES)[number]

// --- Bid increment strategy --------------------------------------------------

export const BID_INCREMENT_STRATEGIES = ["FIXED", "TIERED"] as const
export type BidIncrementStrategy = (typeof BID_INCREMENT_STRATEGIES)[number]

/** A single tiered-increment rule: prices `< upTo` use `increment`. */
export interface IncrementTier {
  /** Upper bound (exclusive) of this tier in Toman; `null` = open-ended top tier. */
  upTo: number | null
  /** Minimum increment (Toman) applied within this tier. */
  increment: number
}

// --- Wallet freeze -----------------------------------------------------------

export const WALLET_FREEZE_MODES = [
  "FULL_BID_OR_DEPOSIT",
  "FULL_BID",
  "BID_DIFFERENCE",
  "FIXED_DEPOSIT",
  "PERCENT_OF_BID",
] as const
export type WalletFreezeMode = (typeof WALLET_FREEZE_MODES)[number]

// --- Reserve price visibility ------------------------------------------------

export const RESERVE_VISIBILITY = ["HIDDEN", "PARTIAL", "VISIBLE", "HIDDEN_OR_PARTIAL"] as const
export type ReserveVisibility = (typeof RESERVE_VISIBILITY)[number]

// --- Risk / anti-fraud actions ----------------------------------------------

export const RISK_ACTIONS = [
  "ALLOW",
  "WARN",
  "MANUAL_REVIEW",
  "BLOCK_BID",
  "BLOCK_USER_FROM_AUCTION",
] as const
export type RiskAction = (typeof RISK_ACTIONS)[number]

// --- Payment-default (unpaid winner) actions --------------------------------

export const PAYMENT_DEFAULT_ACTIONS = [
  "SECOND_CHANCE",
  "REOPEN",
  "CANCEL",
  "PENALTY",
  "RESTRICT_USER",
] as const
export type PaymentDefaultAction = (typeof PAYMENT_DEFAULT_ACTIONS)[number]

// --- Timer display state (derived, real-time-only) --------------------------

export const AUCTION_TIMER_STATES = [
  "NORMAL",
  "ENDING_SOON",
  "CRITICAL",
  "SOFT_CLOSING",
  "ENDED",
] as const
export type AuctionTimerState = (typeof AUCTION_TIMER_STATES)[number]

// --- Full auction policy shape (Phase 2) ------------------------------------

/**
 * Complete, admin-configurable auction policy. Persisted globally as one JSON
 * `Setting` (`auction.policy`) and optionally overridden per-auction via
 * `Auction.policyJson` (a partial merged over the global policy).
 */
export interface AuctionPolicy {
  // Buy Now
  smartBuyNowEnabled: boolean
  buyNowStrategy: BuyNowStrategy
  /** Above this % of reserve/estimated value, Buy Now may auto-disable. */
  buyNowDisableThresholdPercent: number
  /** Premium added over current bid when computing a dynamic Buy Now price. */
  buyNowPremiumPercent: number
  /** Minimum increments Buy Now must sit above the next valid bid. */
  buyNowMinimumGapFromNextBid: number

  // Reserve price
  reservePriceEnabled: boolean
  reservePriceVisibility: ReserveVisibility

  // Soft close / anti-sniping
  softCloseEnabled: boolean
  softCloseWindowSeconds: number
  softCloseExtensionSeconds: number
  maxSoftCloseExtensions: number

  // Bid increments
  bidIncrementStrategy: BidIncrementStrategy
  minimumIncrementRules: IncrementTier[]

  // Wallet / deposit
  walletFreezeEnabled: boolean
  walletFreezeMode: WalletFreezeMode
  walletFreezePercent: number
  entryDepositEnabled: boolean
  entryDepositAmount: number | null

  // Payment / settlement
  paymentDeadlineMinutes: number
  paymentDefaultAction: PaymentDefaultAction
  secondChanceOfferEnabled: boolean
  secondChanceWindowMinutes: number
  /** Days a defaulting winner is barred from bidding (RESTRICT_USER action). */
  defaultRestrictionDays: number

  // Proxy / auto bid (Phase 11 — feature-flagged, schema is already ready)
  proxyBidEnabled: boolean

  // Winner display
  showWinnerOnEndedCard: boolean
  showBidderDisplayName: boolean
  maskBidderIdentity: boolean

  // FOMO timer (real-time-only)
  fomoTimerEnabled: boolean
  endingSoonThresholdSeconds: number
  criticalThresholdSeconds: number

  // Anti-fraud
  auctionAntiFraudEnabled: boolean
  antiFraudDefaultAction: RiskAction
}

// --- Pricing result ----------------------------------------------------------

/** Everything the UI/bid layer needs about an auction's live pricing. */
export interface AuctionPricing {
  hasBids: boolean
  /** Highest bid so far (or start price when there are no bids). */
  currentBid: bigint
  /** Minimum increment for the *next* bid, from the tiered/fixed strategy. */
  minimumIncrement: bigint
  /** Lowest legal value for the next bid. */
  nextMinimumBid: bigint
  /** Adaptive quick-bid amounts (ascending). */
  quickBids: bigint[]
  /** Smart Buy Now price, or `null` when Buy Now is disabled for this state. */
  buyNowPrice: bigint | null
  /** Whether Buy Now is currently offered. */
  buyNowAvailable: boolean
  /** Reserve price (if enabled), else null. */
  reservePrice: bigint | null
  /** Whether the current bid already meets the reserve. */
  reserveMet: boolean
}

// --- Winner result -----------------------------------------------------------

export type AuctionEndReason = "HIGHEST_BID" | "BUY_NOW" | "RESERVE_NOT_MET" | "CANCELLED"

/** Resolved final result of a settled auction (winner engine output). */
export interface AuctionWinnerResult {
  hasWinner: boolean
  winnerUserId: string | null
  finalPrice: bigint | null
  endReason: AuctionEndReason | null
  /** True when derived from legacy data (no stored winner field). */
  legacy: boolean
}
