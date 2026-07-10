import type { RiskAction } from "./types"
import type { AuctionClusterCounts } from "./signals"

/**
 * Pure, deterministic bid-risk scorer (PR6). No I/O — the caller gathers the
 * inputs (cluster counts, account age, per-user velocity) and this maps them to
 * a score, a dominant reason, human-readable signals, and a resolved action.
 *
 * Enforcement policy (per product decision): a bid is BLOCKED only on
 * HIGH-CONFIDENCE, structural collusion — a DISTINCT other account bidding on
 * the SAME auction from the same device fingerprint, or from the same IP AND
 * the same user-agent. Everything softer (new account, velocity, shared subnet)
 * is flagged to the admin review surface but never blocks a bid.
 */

// Accounts younger than this that are already bidding are mildly suspicious.
const NEW_ACCOUNT_MS = 60 * 60 * 1000 // 1 hour
// More than this many bids by one user within the velocity window is bursty.
const VELOCITY_BID_THRESHOLD = 8

export interface BidRiskInput {
  cluster: AuctionClusterCounts
  /** Age of the bidder's account in ms at bid time. */
  accountAgeMs: number
  /** Bids already placed by this user on this auction in the velocity window. */
  recentBidsByUser: number
  /** Resolved policy action for soft/medium flags (never used to force a block). */
  policyAction: RiskAction
}

export interface BidRiskResult {
  /** 0 (clean) .. 100 (high-confidence fraud). */
  score: number
  /** Machine-readable dominant reason. */
  reason: string
  /** Human-friendly contributing signals, for the admin review UI. */
  signals: string[]
  /** Resolved action. Only ever BLOCK_BID for the high-confidence tier. */
  action: RiskAction
  /** Whether the caller must reject the bid. */
  block: boolean
}

export function scoreBidRisk(input: BidRiskInput): BidRiskResult {
  const { cluster, accountAgeMs, recentBidsByUser, policyAction } = input
  const signals: string[] = []
  let score = 0

  // --- High-confidence collusion (structural) → BLOCK -----------------------
  const sameDevice = cluster.sameDevice > 0
  const sameIpAndUa = cluster.sameIp > 0 && cluster.sameUa > 0
  const highConfidence = sameDevice || sameIpAndUa

  if (sameDevice) {
    score = Math.max(score, 95)
    signals.push(`same_device_as_${cluster.sameDevice}_other_bidder(s)`)
  }
  if (sameIpAndUa) {
    score = Math.max(score, 90)
    signals.push(`same_ip_and_ua_as_${cluster.sameIp}_other_bidder(s)`)
  }

  // --- Medium (network overlap) → review, non-blocking ----------------------
  if (!highConfidence && cluster.sameIp > 0) {
    score = Math.max(score, 60)
    signals.push(`same_ip_as_${cluster.sameIp}_other_bidder(s)`)
  }
  if (!highConfidence && cluster.sameSubnet >= 2) {
    score = Math.max(score, 55)
    signals.push(`same_subnet_as_${cluster.sameSubnet}_other_bidder(s)`)
  }

  // --- Soft (behavioural) → warn, non-blocking ------------------------------
  if (accountAgeMs >= 0 && accountAgeMs < NEW_ACCOUNT_MS) {
    score = Math.max(score, 30)
    signals.push("new_account")
  }
  if (recentBidsByUser > VELOCITY_BID_THRESHOLD) {
    score = Math.max(score, 35)
    signals.push(`high_velocity_${recentBidsByUser}_bids`)
  }

  // Dominant reason = first (highest-priority) signal, else clean.
  const reason = signals[0] ?? "clean"

  // Enforcement: block ONLY on the high-confidence tier. For everything else we
  // record the policy's recommended action but never block the bid.
  let action: RiskAction
  let block = false
  if (highConfidence) {
    action = "BLOCK_BID"
    block = true
  } else if (score === 0) {
    action = "ALLOW"
  } else if (score >= 55) {
    // Medium: honour the policy action for labelling, but downgrade any BLOCK_*
    // to MANUAL_REVIEW so soft/medium signals stay non-blocking.
    action =
      policyAction === "BLOCK_BID" || policyAction === "BLOCK_USER_FROM_AUCTION"
        ? "MANUAL_REVIEW"
        : policyAction
  } else {
    action = "WARN"
  }

  return { score, reason, signals, action, block }
}
