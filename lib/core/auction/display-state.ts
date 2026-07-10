/**
 * Auction display-state engine (pure, framework-free).
 *
 * Single source of truth for how an auction should be *presented* across every
 * surface (web card, web detail page, Telegram mini-app). It maps the
 * authoritative lifecycle fields (status / endReason / finalPrice) onto a small
 * set of visual phases + tones + media treatments so the UI never re-derives
 * this logic (previously duplicated & inconsistent between the card and detail
 * page, which left settled auctions looking like plain live ones).
 *
 * Deliberately NON-time-based for the core phase so it is deterministic and
 * hydration-safe on both server and client. The time-sensitive "ending soon"
 * urgency is a separate, opt-in enhancement (see isEndingSoon) that callers
 * compute client-side to avoid SSR/hydration mismatches.
 */

/** How close to the end (ms) a live auction switches to the urgent treatment. */
export const AUCTION_ENDING_SOON_MS = 60 * 60 * 1000 // 1 hour

export type AuctionPhase =
  | "scheduled" // not started yet
  | "live" // running, accepting bids
  | "sold" // settled WITH a winner (highest bid or buy-now)
  | "reserve_not_met" // ended below the reserve → no winner
  | "cancelled" // cancelled by an admin
  | "ended" // terminal with no sale and no specific reason (e.g. no bids)

/** Semantic colour intent; the UI maps this onto design tokens. */
export type AuctionTone = "live" | "scheduled" | "success" | "warning" | "danger" | "neutral"

/** Media styling intent for a card/detail cover image. */
export type AuctionImageTreatment = "none" | "dim" | "muted"

export interface AuctionDisplayState {
  phase: AuctionPhase
  tone: AuctionTone
  isTerminal: boolean
  isLive: boolean
  isScheduled: boolean
  /** Settled with an actual winner (drives the winner spotlight / "sold" visuals). */
  hasWinner: boolean
  imageTreatment: AuctionImageTreatment
  /** Whether a diagonal outcome stamp should overlay the media. */
  showStamp: boolean
  /** i18n key for the status pill/badge. */
  statusKey: string
  /** i18n key for the media stamp, or null when no stamp applies. */
  stampKey: string | null
}

/** Statuses that mean the auction has settled / is no longer accepting bids. */
const TERMINAL_STATUSES = new Set([
  "ENDED",
  "FINALIZED",
  "CANCELLED",
  "SOLD",
  "SETTLED",
  "PAID",
  "PAYMENT_PENDING",
  "RESERVE_NOT_MET",
  "DEFAULTED",
])

export interface DisplayStateInput {
  status: string
  endReason?: string | null
  finalPrice?: number | null
  /** Optional; only used to distinguish "ended, no bids" from a plain end. */
  bidCount?: number | null
}

/**
 * Derive the presentation state from authoritative lifecycle fields.
 * Pure and deterministic — safe to call on the server and during hydration.
 */
export function deriveAuctionDisplayState(input: DisplayStateInput): AuctionDisplayState {
  const { status, endReason = null, finalPrice = null } = input

  const isScheduled = status === "SCHEDULED"
  const isTerminal =
    finalPrice != null || endReason != null || TERMINAL_STATUSES.has(status)

  // --- Non-terminal ---
  if (!isTerminal) {
    if (isScheduled) {
      return {
        phase: "scheduled",
        tone: "scheduled",
        isTerminal: false,
        isLive: false,
        isScheduled: true,
        hasWinner: false,
        imageTreatment: "none",
        showStamp: false,
        statusKey: "auctions.scheduled",
        stampKey: null,
      }
    }
    return {
      phase: "live",
      tone: "live",
      isTerminal: false,
      isLive: true,
      isScheduled: false,
      hasWinner: false,
      imageTreatment: "none",
      showStamp: false,
      statusKey: "auctions.live",
      stampKey: null,
    }
  }

  // --- Terminal ---
  // Cancelled takes priority (explicit reason or status).
  if (endReason === "CANCELLED" || status === "CANCELLED") {
    return terminal("cancelled", "danger", false, "muted", "auctions.cancelled", "auctions.stampCancelled")
  }
  if (endReason === "RESERVE_NOT_MET" || status === "RESERVE_NOT_MET") {
    return terminal(
      "reserve_not_met",
      "warning",
      false,
      "muted",
      "auctions.reserveNotMetShort",
      "auctions.stampUnsold",
    )
  }
  // Settled with a winner: explicit sale reason, or an authoritative final price.
  if (endReason === "HIGHEST_BID" || endReason === "BUY_NOW" || finalPrice != null) {
    return terminal("sold", "success", true, "dim", "auctions.sold", "auctions.stampSold")
  }
  // Generic terminal with no sale (e.g. ended with no bids).
  return terminal("ended", "neutral", false, "muted", "auctions.ended", "auctions.stampEnded")
}

function terminal(
  phase: AuctionPhase,
  tone: AuctionTone,
  hasWinner: boolean,
  imageTreatment: AuctionImageTreatment,
  statusKey: string,
  stampKey: string,
): AuctionDisplayState {
  return {
    phase,
    tone,
    isTerminal: true,
    isLive: false,
    isScheduled: false,
    hasWinner,
    imageTreatment,
    showStamp: true,
    statusKey,
    stampKey,
  }
}

/**
 * Time-sensitive urgency flag for a LIVE auction. Returns true when the auction
 * is live and ends within AUCTION_ENDING_SOON_MS. Callers on the client should
 * gate this behind a mounted flag to avoid hydration mismatches.
 */
export function isEndingSoon(
  state: Pick<AuctionDisplayState, "isLive">,
  endTime: string | number | Date,
  now: number = Date.now(),
  windowMs: number = AUCTION_ENDING_SOON_MS,
): boolean {
  if (!state.isLive) return false
  const end = endTime instanceof Date ? endTime.getTime() : new Date(endTime).getTime()
  if (Number.isNaN(end)) return false
  const remaining = end - now
  return remaining > 0 && remaining <= windowMs
}

/** Tailwind class fragments for each media treatment. */
export const IMAGE_TREATMENT_CLASS: Record<AuctionImageTreatment, string> = {
  none: "",
  dim: "brightness-[0.72]",
  muted: "grayscale-[0.85] brightness-[0.6]",
}

/** Design-token classes for a status pill per tone. */
export const TONE_PILL_CLASS: Record<AuctionTone, string> = {
  live: "border-success/40 bg-success/15 text-success",
  scheduled: "border-primary/40 bg-primary/15 text-primary",
  success: "border-success/40 bg-success/15 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning",
  danger: "border-destructive/40 bg-destructive/15 text-destructive",
  neutral: "border-border bg-secondary text-muted-foreground",
}
