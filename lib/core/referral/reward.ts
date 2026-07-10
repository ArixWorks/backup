import type { Prisma, ReferralReward, ReferralRewardStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { serializableTx } from "@/lib/core/ledger"
import { ensureWallet, creditReferralBonus } from "@/lib/core/wallet"
import { audit } from "@/lib/core/audit"
import { getReferralPolicy, type ReferralPolicy } from "./policy"
import { getRelation, advanceStatus, rank } from "./relations"
import { evaluateReward } from "./risk"

type Tx = Prisma.TransactionClient

/** Deterministic idempotency key: one reward per (beneficiary, trigger user). */
export function triggerKeyFor(beneficiaryId: string, triggerUserId: string): string {
  return `L2:${beneficiaryId}:${triggerUserId}`
}

export interface ActivateResult {
  /** Whether a reward row now exists for this trigger. */
  created: boolean
  status?: ReferralRewardStatus
  rewardId?: string
  beneficiaryId?: string
  amount?: bigint
  /** True when the wallet was credited during this activation. */
  credited?: boolean
  reason?: string
}

/**
 * Credit a reward's amount to the beneficiary's wallet exactly once, inside a
 * serializable transaction. Status-gated so a concurrent approval/cron cannot
 * double-pay: only a row still lacking `creditedAt` is credited, and the status
 * is flipped to the terminal `finalStatus` in the same tx. All money movement
 * goes through the Wallet engine (creditReferralBonus).
 */
async function creditRewardOnce(
  rewardId: string,
  finalStatus: "AUTO_APPROVED" | "APPROVED",
  decidedById?: string | null,
): Promise<boolean> {
  return serializableTx(async (tx: Tx) => {
    const reward = await tx.referralReward.findUnique({ where: { id: rewardId } })
    if (!reward) return false
    if (reward.creditedAt) return false // already credited
    if (reward.status === "REJECTED" || reward.status === "BLOCKED") return false

    // Flip status + stamp creditedAt first (guards against concurrent credit).
    const claimed = await tx.referralReward.updateMany({
      where: { id: rewardId, creditedAt: null, status: { notIn: ["REJECTED", "BLOCKED"] } },
      data: {
        status: finalStatus,
        creditedAt: new Date(),
        decidedById: decidedById ?? null,
        decidedAt: finalStatus === "APPROVED" ? new Date() : null,
      },
    })
    if (claimed.count !== 1) return false // lost the race

    if (reward.amount > 0n) {
      await ensureWallet(reward.beneficiaryId, tx)
      await creditReferralBonus(reward.beneficiaryId, reward.amount, tx, {
        type: "referral_l2",
        id: reward.triggerUserId,
      })
    }
    return true
  })
}

/** How many rewards the beneficiary already got auto/approved in the last day. */
async function rewardsInLastDay(beneficiaryId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return prisma.referralReward.count({
    where: {
      beneficiaryId,
      status: { in: ["AUTO_APPROVED", "APPROVED"] },
      creditedAt: { gte: since },
    },
  })
}

/** Whether the beneficiary is inside the per-reward cooldown window. */
async function inCooldown(beneficiaryId: string, cooldownSec: number): Promise<boolean> {
  if (cooldownSec <= 0) return false
  const since = new Date(Date.now() - cooldownSec * 1000)
  const recent = await prisma.referralReward.findFirst({
    where: { beneficiaryId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  })
  return Boolean(recent)
}

/**
 * Activate the second-level reward flow for a trigger user C who has just passed
 * the mandatory channel gate. Resolves the chain C → B (middle) → A (root
 * beneficiary), enforces every gate (channel verification of both C and B,
 * cooldown, daily cap, idempotency), runs the Risk Engine, and either
 * auto-approves + credits (clean) or parks the reward for review / blocks it.
 *
 * Idempotent via the unique triggerKey; safe to call repeatedly.
 */
export async function activateSecondLevel(triggerUserId: string): Promise<ActivateResult> {
  const policy = await getReferralPolicy()
  if (!policy.enabled || !policy.secondLevelReward) return { created: false, reason: "disabled" }

  const triggerRel = await getRelation(triggerUserId)
  if (!triggerRel) return { created: false, reason: "no_relation" }

  // The trigger user must themselves be channel-verified (when gating is on).
  if (
    policy.activateSecondLevelOnlyAfterChannelVerification &&
    rank(triggerRel.status) < rank("CHANNEL_MEMBERSHIP_VERIFIED")
  ) {
    return { created: false, reason: "trigger_not_verified" }
  }

  const middleUserId = triggerRel.parentInviterId
  const beneficiaryId = triggerRel.rootInviterId
  // No root inviter → this is only a first-level chain; nothing to reward.
  if (!beneficiaryId) {
    await advanceStatus(triggerUserId, "SECOND_LEVEL_TRIGGERED").catch(() => {})
    return { created: false, reason: "no_root_inviter" }
  }

  // The middle inviter B must also have passed the channel gate for the invite
  // chain to be valid (both hops verified).
  if (policy.requireMandatoryChannelMembership) {
    const middleRel = await getRelation(middleUserId)
    // A relation only exists for users who were themselves invited. If B was a
    // top-level user (no inviter) they have no relation — that's fine, they are
    // implicitly "verified" as far as this chain is concerned. If a relation
    // exists it must be at least channel-verified.
    if (middleRel && rank(middleRel.status) < rank("CHANNEL_MEMBERSHIP_VERIFIED")) {
      return { created: false, reason: "middle_not_verified" }
    }
  }

  const key = triggerKeyFor(beneficiaryId, triggerUserId)
  const existing = await prisma.referralReward.findUnique({ where: { triggerKey: key } })
  if (existing) {
    await advanceStatus(triggerUserId, "SECOND_LEVEL_TRIGGERED").catch(() => {})
    return {
      created: false,
      status: existing.status,
      rewardId: existing.id,
      reason: "already_exists",
    }
  }

  // Cooldown + daily cap gates (soft → route to review rather than block).
  const cooling = await inCooldown(beneficiaryId, policy.rewardCooldownSec)
  const overDailyCap =
    policy.maxRewardsPerBeneficiaryPerDay > 0 &&
    (await rewardsInLastDay(beneficiaryId)) >= policy.maxRewardsPerBeneficiaryPerDay

  // Risk evaluation.
  const risk = await evaluateReward({ beneficiaryId, middleUserId, triggerUserId, policy })

  // Decide the initial lifecycle status.
  let status: ReferralRewardStatus
  if (risk.action === "BLOCKED") status = "BLOCKED"
  else if (risk.action === "PENDING_REVIEW" || cooling || overDailyCap) status = "PENDING_REVIEW"
  else status = "AUTO_APPROVED"

  const amount = BigInt(Math.round(policy.rewardAmount))

  // Create the reward row (idempotent on triggerKey under concurrency).
  let reward: ReferralReward
  try {
    reward = await prisma.referralReward.create({
      data: {
        triggerKey: key,
        beneficiaryId,
        triggerUserId,
        middleUserId,
        amount,
        currency: policy.currency,
        status: status === "AUTO_APPROVED" ? "PENDING" : status,
        riskScore: risk.score,
        riskReason: cooling ? `cooldown|${risk.reason}` : overDailyCap ? `daily_cap|${risk.reason}` : risk.reason,
      },
    })
  } catch {
    // Unique collision → another concurrent activation won; treat as exists.
    const again = await prisma.referralReward.findUnique({ where: { triggerKey: key } })
    await advanceStatus(triggerUserId, "SECOND_LEVEL_TRIGGERED").catch(() => {})
    return { created: false, status: again?.status, rewardId: again?.id, reason: "race_exists" }
  }

  await advanceStatus(triggerUserId, "SECOND_LEVEL_TRIGGERED").catch(() => {})

  await audit({
    action: "REFERRAL_L2_REWARD_CREATED",
    entity: "referral_reward",
    entityId: reward.id,
    actorId: beneficiaryId,
    meta: {
      triggerUserId,
      middleUserId,
      amount: amount.toString(),
      status,
      riskScore: risk.score,
      signals: risk.signals,
    },
  }).catch(() => {})

  let credited = false
  if (status === "AUTO_APPROVED") {
    credited = await creditRewardOnce(reward.id, "AUTO_APPROVED")
  }

  return {
    created: true,
    status,
    rewardId: reward.id,
    beneficiaryId,
    amount,
    credited,
    reason: risk.reason,
  }
}

// --- Admin actions -----------------------------------------------------------

/** Approve a reviewed reward → credit the beneficiary's wallet. */
export async function approveReward(rewardId: string, adminId: string): Promise<boolean> {
  const reward = await prisma.referralReward.findUnique({ where: { id: rewardId } })
  if (!reward || reward.status !== "PENDING_REVIEW") return false
  const credited = await creditRewardOnce(rewardId, "APPROVED", adminId)
  await audit({
    action: "REFERRAL_L2_REWARD_APPROVED",
    entity: "referral_reward",
    entityId: rewardId,
    actorId: adminId,
    meta: { credited },
  }).catch(() => {})
  return credited
}

/** Reject a reviewed reward (no credit). */
export async function rejectReward(rewardId: string, adminId: string, reason?: string): Promise<boolean> {
  const res = await prisma.referralReward.updateMany({
    where: { id: rewardId, status: "PENDING_REVIEW", creditedAt: null },
    data: { status: "REJECTED", decidedById: adminId, decidedAt: new Date(), riskReason: reason?.trim() || undefined },
  })
  if (res.count !== 1) return false
  await audit({
    action: "REFERRAL_L2_REWARD_REJECTED",
    entity: "referral_reward",
    entityId: rewardId,
    actorId: adminId,
    meta: { reason: reason ?? null },
  }).catch(() => {})
  return true
}

/** Block a reviewed/pending reward as high-confidence abuse (no credit). */
export async function blockReward(rewardId: string, adminId: string, reason?: string): Promise<boolean> {
  const res = await prisma.referralReward.updateMany({
    where: { id: rewardId, creditedAt: null, status: { notIn: ["APPROVED", "AUTO_APPROVED"] } },
    data: { status: "BLOCKED", decidedById: adminId, decidedAt: new Date(), riskReason: reason?.trim() || undefined },
  })
  if (res.count !== 1) return false
  await audit({
    action: "REFERRAL_L2_REWARD_BLOCKED",
    entity: "referral_reward",
    entityId: rewardId,
    actorId: adminId,
    meta: { reason: reason ?? null },
  }).catch(() => {})
  return true
}

// --- Cron re-evaluation ------------------------------------------------------

/**
 * Re-evaluate rewards that were parked for review purely because of a maturity
 * or cooldown gate (not a hard abuse signal) and whose gates have since cleared.
 * Auto-approves the now-clean ones. Hard-flagged rewards (device/ip/loop) are
 * left for a human. Returns a small summary for the cron tick.
 */
export async function processPendingReferralRewards(): Promise<{ scanned: number; approved: number }> {
  const policy = await getReferralPolicy()
  if (!policy.enabled) return { scanned: 0, approved: 0 }

  const pending = await prisma.referralReward.findMany({
    where: { status: "PENDING_REVIEW", creditedAt: null },
    orderBy: { createdAt: "asc" },
    take: 200,
  })

  let approved = 0
  for (const r of pending) {
    // Only auto-heal rewards parked for soft (maturity/cooldown) reasons.
    const soft = /cooldown|daily_cap|account_too_new/.test(r.riskReason ?? "")
    if (!soft) continue
    const risk = await evaluateReward({
      beneficiaryId: r.beneficiaryId,
      middleUserId: r.middleUserId,
      triggerUserId: r.triggerUserId,
      policy,
    })
    if (risk.action !== "AUTO_APPROVED") continue
    if (await inCooldown(r.beneficiaryId, policy.rewardCooldownSec)) continue
    if (
      policy.maxRewardsPerBeneficiaryPerDay > 0 &&
      (await rewardsInLastDay(r.beneficiaryId)) >= policy.maxRewardsPerBeneficiaryPerDay
    )
      continue
    // Move to PENDING then credit-once as AUTO_APPROVED.
    await prisma.referralReward.updateMany({
      where: { id: r.id, status: "PENDING_REVIEW", creditedAt: null },
      data: { status: "PENDING", riskScore: risk.score, riskReason: risk.reason },
    })
    if (await creditRewardOnce(r.id, "AUTO_APPROVED")) approved++
  }
  return { scanned: pending.length, approved }
}
