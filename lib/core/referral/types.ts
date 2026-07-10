/**
 * Shared types for the multi-level referral engine.
 *
 * The engine is provider-agnostic and layered on top of the existing Wallet,
 * Ledger, Settings, Audit and Notification engines — it never talks to the
 * database's money tables directly (all credits go through the Wallet engine).
 */

/** Where an invite originated, used for anti-abuse signal capture. */
export type ReferralSource = "web" | "telegram"

/**
 * Raw, un-hashed anti-abuse context captured when a referral is attached or a
 * user passes the channel gate. The engine hashes these before persisting so no
 * identifiable network data is ever stored.
 */
export interface RiskContext {
  source: ReferralSource
  /** Client IP (web: x-forwarded-for; telegram: n/a). */
  ip?: string | null
  /** User-Agent header (web only). */
  userAgent?: string | null
  /** Stable device/client fingerprint if the client supplies one. */
  deviceId?: string | null
}

/** Outcome of the anti-abuse risk evaluation for a candidate reward. */
export interface RiskEvaluation {
  /** 0 (clean) .. 100 (high-confidence abuse). */
  score: number
  /** Machine-readable dominant reason, e.g. "same_device_cluster". */
  reason: string
  /** Human-friendly signals that contributed, for the admin review UI. */
  signals: string[]
  /** Recommended action derived from the score + policy thresholds. */
  action: "AUTO_APPROVED" | "PENDING_REVIEW" | "BLOCKED"
}
