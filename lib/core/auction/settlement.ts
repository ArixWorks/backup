/**
 * AuctionSettlementEngine — pure money math for the freeze/settlement lifecycle
 * (PR4). Given a bid + the resolved policy it decides HOW MUCH to freeze, and
 * given a winner's held funds vs the final price it decides whether the auction
 * settles instantly (fully-funded) or must wait for the winner to pay a balance
 * before a deadline (deposit / partial-freeze).
 *
 * SAFETY-FIRST DEFAULT: the live system freezes the FULL winning bid and settles
 * instantly, which makes an unpaid-winner scenario impossible. Every helper here
 * returns "full bid / fully funded" unless a policy EXPLICITLY opts into a
 * deposit or partial-freeze mode — so the default behaviour is byte-for-byte
 * unchanged. The deadline / default / second-chance lifecycle only ever engages
 * for a freeze mode that can leave a winner underfunded.
 *
 * All amounts are `bigint` (matches Prisma BigInt columns). Pure + deterministic
 * so the winner-default flows are fully unit-testable without a database.
 */

import type { AuctionPolicy, PaymentDefaultAction, WalletFreezeMode } from "./types"

/** The subset of policy this engine reads (keeps callers honest + testable). */
export type FreezePolicy = Pick<
  AuctionPolicy,
  | "walletFreezeEnabled"
  | "walletFreezeMode"
  | "walletFreezePercent"
  | "entryDepositEnabled"
  | "entryDepositAmount"
>

/** Clamp a computed hold into `[min(1,bid) .. bid]` — never over-freeze a bid, */
/** and never zero-freeze a positive bid (a live bid always carries commitment). */
function clampHold(hold: bigint, bid: bigint): bigint {
  if (bid <= 0n) return 0n
  if (hold >= bid) return bid
  if (hold <= 0n) return 1n
  return hold
}

/** The configured entry deposit as bigint, or null when not explicitly set. */
function depositAmount(policy: FreezePolicy): bigint | null {
  if (!policy.entryDepositEnabled) return null
  if (policy.entryDepositAmount == null) return null
  const v = Math.max(0, Math.round(policy.entryDepositAmount))
  return v > 0 ? BigInt(v) : null
}

/**
 * How much of a bidder's wallet to freeze for a given bid under the resolved
 * policy. Returns the FULL bid (current safe behaviour) unless a deposit /
 * partial mode is explicitly configured.
 *
 * HARD SAFETY GATES (always full freeze, no unpaid-winner risk):
 *  - wallet freezing disabled → full bid (legacy behaviour).
 *  - multi-winner auctions (quantity !== 1) → full bid. The deposit/payment
 *    lifecycle is single-obligation; multi-winner settlement stays instant.
 */
export function computeBidFreezeTarget(opts: {
  bidAmount: bigint
  startPrice: bigint
  quantity: number
  policy: FreezePolicy
}): bigint {
  const { bidAmount, startPrice, quantity, policy } = opts
  if (bidAmount <= 0n) return 0n
  // Safety gates: anything other than a single-winner, freeze-enabled auction
  // keeps the full-bid freeze so settlement can always complete instantly.
  if (!policy.walletFreezeEnabled || quantity !== 1) return bidAmount

  const dep = depositAmount(policy)
  const mode: WalletFreezeMode = policy.walletFreezeMode

  switch (mode) {
    case "FULL_BID":
      return bidAmount
    case "FULL_BID_OR_DEPOSIT":
      // Full bid is the default; only drops to a deposit when one is configured.
      return dep != null ? clampHold(dep, bidAmount) : bidAmount
    case "FIXED_DEPOSIT":
      // Fixed deposit when configured; otherwise fall back to the safe full bid.
      return dep != null ? clampHold(dep, bidAmount) : bidAmount
    case "PERCENT_OF_BID": {
      const pct = BigInt(Math.max(0, Math.min(100, Math.round(policy.walletFreezePercent))))
      if (pct >= 100n) return bidAmount
      return clampHold((bidAmount * pct) / 100n, bidAmount)
    }
    case "BID_DIFFERENCE": {
      // Freeze only the commitment above the start price (a partial hold).
      const hold = bidAmount > startPrice ? bidAmount - startPrice : bidAmount
      return clampHold(hold, bidAmount)
    }
    default:
      return bidAmount
  }
}

/**
 * Whether the resolved freeze policy can leave a winner underfunded — i.e. the
 * freeze target for a winning bid may be LESS than the final price, creating an
 * unpaid-winner scenario. Only when this is true does the deadline / default /
 * second-chance lifecycle engage. Full-freeze modes return false.
 */
export function freezeModeCanUnderfund(opts: {
  quantity: number
  policy: FreezePolicy
}): boolean {
  const { quantity, policy } = opts
  if (!policy.walletFreezeEnabled || quantity !== 1) return false
  switch (policy.walletFreezeMode) {
    case "FULL_BID":
      return false
    case "FULL_BID_OR_DEPOSIT":
    case "FIXED_DEPOSIT":
      return depositAmount(policy) != null
    case "PERCENT_OF_BID":
      return Math.round(policy.walletFreezePercent) < 100
    case "BID_DIFFERENCE":
      return true
    default:
      return false
  }
}

/** A winner's settlement obligation given what they already have frozen. */
export interface WinnerObligation {
  /** Total the winner owes (the final/winning price). */
  finalPrice: bigint
  /** Amount already frozen as a deposit/partial hold. */
  heldDeposit: bigint
  /** Remaining balance to collect from available funds (never negative). */
  remaining: bigint
  /** True when the held funds already cover the full price → settle instantly. */
  fullyFunded: boolean
}

/**
 * Resolve a winner's obligation. `fullyFunded` (held >= price) is the safe,
 * instant-settlement path (today's default). Otherwise a balance is owed.
 */
export function computeWinnerObligation(opts: {
  finalPrice: bigint
  heldDeposit: bigint
}): WinnerObligation {
  const finalPrice = opts.finalPrice < 0n ? 0n : opts.finalPrice
  const heldDeposit = opts.heldDeposit < 0n ? 0n : opts.heldDeposit
  const remaining = finalPrice > heldDeposit ? finalPrice - heldDeposit : 0n
  return {
    finalPrice,
    heldDeposit,
    remaining,
    fullyFunded: heldDeposit >= finalPrice,
  }
}

/**
 * The effective winner-default action for a policy. Second-chance is only
 * selectable when the offer feature itself is enabled; otherwise it degrades to
 * the safe CANCEL fallback so a disabled feature can never strand an auction.
 */
export function resolveDefaultAction(policy: AuctionPolicy): PaymentDefaultAction {
  const action = policy.paymentDefaultAction
  if (action === "SECOND_CHANCE" && !policy.secondChanceOfferEnabled) return "CANCEL"
  return action
}

/** Number of days a defaulting winner is restricted (RESTRICT_USER action). */
export function restrictionDays(policy: AuctionPolicy): number {
  const d = Math.round(policy.defaultRestrictionDays)
  return Number.isFinite(d) && d > 0 ? d : 30
}
