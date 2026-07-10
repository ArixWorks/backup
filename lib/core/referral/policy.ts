import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { SETTING_KEYS, getSetting, setSetting } from "@/lib/core/settings"

type Db = Prisma.TransactionClient | typeof prisma

/** When the flagged-reward default policy action should be, it is configurable here. */
export type FlaggedAction = "PENDING_REVIEW" | "BLOCKED"

/**
 * Full, admin-configurable policy for the Level-2 referral engine. Persisted as
 * a single JSON `Setting` (SETTING_KEYS.referralL2Policy) so the whole policy is
 * read/written atomically. NOTHING here is hardcoded at a call site — every rule
 * flows from this object, with DEFAULT_REFERRAL_POLICY as the fallback.
 */
export interface ReferralPolicy {
  /** Master switch for the second-level engine. */
  enabled: boolean

  // --- Reward model --------------------------------------------------------
  /** Level at which a reward is granted (2 = second-level only). */
  rewardTriggerLevel: number
  /** A direct (level-1) invite fires a notification only. */
  directInviteNotification: boolean
  /** A direct (level-1) invite grants NO reward. */
  directInviteReward: boolean
  /** Grant the second-level reward at all. */
  secondLevelReward: boolean
  /** Who receives the reward. Currently always the root inviter. */
  rewardReceiver: "ROOT_INVITER"
  /** Reward amount in minor units of `currency` (IRT = Toman). */
  rewardAmount: number
  currency: string

  // --- Mandatory channel-membership gates ----------------------------------
  /** Require the invited user to pass the forced-channel gate for the invite to count. */
  requireMandatoryChannelMembership: boolean
  /** Notify the direct inviter after the invited user passes the channel gate. */
  notifyInviterAfterChannelVerification: boolean
  /** Only activate the second-level reward after the trigger user passes the gate. */
  activateSecondLevelOnlyAfterChannelVerification: boolean

  // --- Anti-abuse / approval ----------------------------------------------
  /** Require anti-abuse approval before crediting (belt-and-suspenders). */
  requireAntiAbuseApproval: boolean
  /** Reward lifecycle mode. */
  rewardWalletMode: "PENDING_THEN_APPROVED"
  /** Risk score (inclusive) at/above which a reward is auto-blocked. */
  blockScoreThreshold: number
  /** Risk score (inclusive) at/above which a reward goes to manual review. */
  reviewScoreThreshold: number
  /** Default action for a flagged (uncertain) reward. */
  flaggedAction: FlaggedAction

  // --- Maturity / cooldown -------------------------------------------------
  /** Minimum account age (minutes) of the trigger user before a reward matures. */
  minTriggerAccountAgeMin: number
  /** Minimum account age (minutes) of the beneficiary before a reward matures. */
  minBeneficiaryAccountAgeMin: number
  /** Cooldown (seconds) between consecutive rewards for the same beneficiary. */
  rewardCooldownSec: number
  /** Max auto-approved second-level rewards per beneficiary per rolling day (0 = unlimited). */
  maxRewardsPerBeneficiaryPerDay: number

  // --- Anti-abuse signal windows ------------------------------------------
  /** Max distinct invites sharing one IP hash before it is treated as a burst. */
  maxPerIpHash: number
  /** Max distinct invites sharing one subnet hash before it is treated as a burst. */
  maxPerSubnetHash: number
  /** Max distinct invites sharing one device hash before it is a same-device cluster. */
  maxPerDeviceHash: number
}

export const DEFAULT_REFERRAL_POLICY: ReferralPolicy = {
  enabled: true,

  rewardTriggerLevel: 2,
  directInviteNotification: true,
  directInviteReward: false,
  secondLevelReward: true,
  rewardReceiver: "ROOT_INVITER",
  rewardAmount: 20000,
  currency: "IRT",

  requireMandatoryChannelMembership: true,
  notifyInviterAfterChannelVerification: true,
  activateSecondLevelOnlyAfterChannelVerification: true,

  requireAntiAbuseApproval: true,
  rewardWalletMode: "PENDING_THEN_APPROVED",
  blockScoreThreshold: 85,
  reviewScoreThreshold: 40,
  flaggedAction: "PENDING_REVIEW",

  minTriggerAccountAgeMin: 60,
  minBeneficiaryAccountAgeMin: 0,
  rewardCooldownSec: 30,
  maxRewardsPerBeneficiaryPerDay: 0,

  maxPerIpHash: 3,
  maxPerSubnetHash: 6,
  maxPerDeviceHash: 1,
}

/** Coerce an arbitrary parsed object into a complete, valid policy. */
function normalize(raw: unknown): ReferralPolicy {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_REFERRAL_POLICY }
  const p = raw as Record<string, unknown>
  const out: ReferralPolicy = { ...DEFAULT_REFERRAL_POLICY }
  for (const key of Object.keys(DEFAULT_REFERRAL_POLICY) as (keyof ReferralPolicy)[]) {
    const v = p[key]
    const def = DEFAULT_REFERRAL_POLICY[key]
    if (v === undefined || v === null) continue
    if (typeof def === "boolean" && typeof v === "boolean") (out[key] as boolean) = v
    else if (typeof def === "number" && typeof v === "number" && Number.isFinite(v))
      (out[key] as number) = v
    else if (typeof def === "string" && typeof v === "string") (out[key] as string) = v
  }
  // Guard invariants that must never be violated by a bad admin write.
  out.rewardTriggerLevel = 2
  out.rewardReceiver = "ROOT_INVITER"
  out.rewardWalletMode = "PENDING_THEN_APPROVED"
  out.directInviteReward = false
  if (out.flaggedAction !== "BLOCKED") out.flaggedAction = "PENDING_REVIEW"
  out.rewardAmount = Math.max(0, Math.round(out.rewardAmount))
  return out
}

/** Read the active policy, falling back to the built-in default. */
export async function getReferralPolicy(db: Db = prisma): Promise<ReferralPolicy> {
  const raw = await getSetting(SETTING_KEYS.referralL2Policy, db)
  if (!raw.trim()) return { ...DEFAULT_REFERRAL_POLICY }
  try {
    return normalize(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_REFERRAL_POLICY }
  }
}

/** Persist a (partial) policy update, merged over the current policy. */
export async function setReferralPolicy(patch: Partial<ReferralPolicy>): Promise<ReferralPolicy> {
  const current = await getReferralPolicy()
  const next = normalize({ ...current, ...patch })
  await setSetting(SETTING_KEYS.referralL2Policy, JSON.stringify(next))
  return next
}
