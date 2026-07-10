import type { ReserveVisibility } from "./types"
import type { AuctionEndReason } from "./types"

/**
 * Public reserve display state (PR7).
 * - "met"     → reveal that the reserve has been reached
 * - "not_met" → reveal that the reserve has NOT yet been reached
 * - "hidden"  → do NOT reveal whether the reserve is met (existence only)
 */
export type ReserveState = "met" | "not_met" | "hidden"

export interface ReserveDisplay {
  /** Whether a reserve price is configured at all. */
  exists: boolean
  /** Whether/how the met status may be revealed to the public. */
  state: ReserveState
  /** Exact reserve amount — populated ONLY when policy visibility is VISIBLE. */
  amount: bigint | null
}

/**
 * Compute the privacy-safe reserve display for a public auction view (PR7).
 *
 * This is the single source of truth for what the client is allowed to learn
 * about the reserve. It is computed server-side so hidden data never reaches
 * the wire — the payload for a HIDDEN reserve carries neither the amount nor
 * the met/not-met status.
 *
 * Visibility semantics (while the auction is LIVE):
 * - VISIBLE            → reveal met/not-met AND the exact amount
 * - PARTIAL            → reveal met/not-met, hide the amount
 * - HIDDEN_OR_PARTIAL  → reveal met/not-met, hide the amount (default)
 * - HIDDEN             → reveal existence only (no status, no amount)
 *
 * Once the auction is TERMINAL the outcome is inherently public (a
 * RESERVE_NOT_MET auction ends with no winner), so the met/not-met status is
 * always revealed; the exact amount still follows the VISIBLE rule.
 */
export function computeReserveDisplay(opts: {
  reservePrice: bigint | null
  currentPrice: bigint
  visibility: ReserveVisibility
  isTerminal: boolean
  endReason: AuctionEndReason | null
}): ReserveDisplay {
  const { reservePrice, currentPrice, visibility, isTerminal, endReason } = opts

  if (reservePrice == null) {
    return { exists: false, state: "hidden", amount: null }
  }

  const amount = visibility === "VISIBLE" ? reservePrice : null

  if (isTerminal) {
    // The result is already public once settled.
    const state: ReserveState = endReason === "RESERVE_NOT_MET" ? "not_met" : "met"
    return { exists: true, state, amount }
  }

  if (visibility === "HIDDEN") {
    return { exists: true, state: "hidden", amount: null }
  }

  // VISIBLE, PARTIAL, HIDDEN_OR_PARTIAL all reveal the met/not-met status live.
  const state: ReserveState = currentPrice >= reservePrice ? "met" : "not_met"
  return { exists: true, state, amount }
}
