/**
 * AuctionLifecycleEngine — status + timer-state derivation. Pure functions:
 * given a DB status, timestamps and the resolved policy, it derives the display
 * state the UI renders (Phase 7 FOMO timer + Phase 23 states). All urgency is
 * based on REAL remaining time only — never fabricated.
 */

import type { AuctionPolicy, AuctionTimerState } from "./types"

/** Prisma `AuctionStatus` values (kept as a string union to avoid importing enums). */
export type AuctionStatusValue =
  | "SCHEDULED"
  | "ACTIVE"
  | "ENDED"
  | "FINALIZED"
  | "CANCELLED"
  | "SOLD"
  | "PAYMENT_PENDING"
  | "PAID"
  | "SETTLED"
  | "RESERVE_NOT_MET"
  | "DEFAULTED"

const TERMINAL: AuctionStatusValue[] = [
  "FINALIZED",
  "CANCELLED",
  "SOLD",
  "SETTLED",
  "RESERVE_NOT_MET",
  "DEFAULTED",
  "PAID",
]

/** Auction is fully concluded (no more bids, settled or terminal). */
export function isTerminalStatus(status: string): boolean {
  return (TERMINAL as string[]).includes(status)
}

/** Auction can still take bids right now (respects start/end window). */
export function isBiddable(
  auction: { status: string; startTime: Date; endTime: Date },
  now: Date = new Date(),
): boolean {
  if (auction.status !== "ACTIVE" && auction.status !== "SCHEDULED") return false
  if (now < auction.startTime) return false
  if (now >= auction.endTime) return false
  return true
}

/** Whether the auction has passed its end time (regardless of finalization). */
export function hasEnded(
  auction: { status: string; endTime: Date },
  now: Date = new Date(),
): boolean {
  if (isTerminalStatus(auction.status) || auction.status === "ENDED") return true
  return now >= auction.endTime
}

/**
 * Derive the real-time timer state used to drive countdown urgency. Returns
 * NORMAL when the FOMO timer is disabled by policy so the UI shows a plain
 * countdown. SOFT_CLOSING is signalled by the caller (recent extension) via
 * `recentlyExtended`.
 */
export function deriveTimerState(
  opts: {
    status: string
    endTime: Date
    recentlyExtended?: boolean
  },
  policy: AuctionPolicy,
  now: Date = new Date(),
): AuctionTimerState {
  if (hasEnded({ status: opts.status, endTime: opts.endTime }, now)) return "ENDED"
  const remainingSec = Math.max(0, Math.floor((opts.endTime.getTime() - now.getTime()) / 1000))
  if (remainingSec <= 0) return "ENDED"
  if (opts.recentlyExtended) return "SOFT_CLOSING"
  if (!policy.fomoTimerEnabled) return "NORMAL"
  if (remainingSec <= policy.criticalThresholdSeconds) return "CRITICAL"
  if (remainingSec <= policy.endingSoonThresholdSeconds) return "ENDING_SOON"
  return "NORMAL"
}

/** Seconds remaining (never negative). */
export function secondsRemaining(endTime: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000))
}

/**
 * Compute the extended end time if a bid lands inside the soft-close window and
 * the extension cap has not been reached. Returns `null` when no extension
 * applies. Pure — the caller persists `endTime`/`softCloseExtensions`.
 */
export function computeSoftCloseExtension(
  opts: { endTime: Date; softCloseExtensions: number },
  policy: AuctionPolicy,
  now: Date = new Date(),
): Date | null {
  if (!policy.softCloseEnabled) return null
  if (opts.softCloseExtensions >= policy.maxSoftCloseExtensions) return null
  const remainingMs = opts.endTime.getTime() - now.getTime()
  if (remainingMs > policy.softCloseWindowSeconds * 1000) return null
  if (remainingMs <= 0) return null
  return new Date(opts.endTime.getTime() + policy.softCloseExtensionSeconds * 1000)
}

/** When the payment deadline should fall for a just-settled winner. */
export function computePaymentDeadline(
  policy: AuctionPolicy,
  from: Date = new Date(),
): Date | null {
  if (policy.paymentDeadlineMinutes <= 0) return null
  return new Date(from.getTime() + policy.paymentDeadlineMinutes * 60_000)
}
