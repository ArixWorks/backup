import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { ReferralPolicy } from "./policy"
import type { RiskEvaluation } from "./types"
import { getSignalFor, clusterCounts } from "./signals"

type Db = Prisma.TransactionClient | typeof prisma

function ageMinutes(createdAt: Date): number {
  return (Date.now() - createdAt.getTime()) / 60000
}

/**
 * Evaluate the anti-abuse risk of a candidate second-level reward. Pure scoring:
 * combines same-device clusters, same-network bursts, self-referral / loop
 * signals, and account-maturity into a 0..100 score, then maps it to an action
 * using the policy thresholds. Never credits or mutates anything.
 */
export async function evaluateReward(
  args: {
    beneficiaryId: string
    middleUserId: string
    triggerUserId: string
    policy: ReferralPolicy
  },
  db: Db = prisma,
): Promise<RiskEvaluation> {
  const { beneficiaryId, middleUserId, triggerUserId, policy } = args
  const signals: string[] = []
  let score = 0

  // --- Structural self-referral / loop signals (high confidence) ----------
  if (beneficiaryId === triggerUserId || beneficiaryId === middleUserId || middleUserId === triggerUserId) {
    signals.push("self_or_loop_chain")
    score = 100
  }

  const [trigger, beneficiary, sig] = await Promise.all([
    db.user.findUnique({ where: { id: triggerUserId }, select: { createdAt: true } }),
    db.user.findUnique({ where: { id: beneficiaryId }, select: { createdAt: true } }),
    getSignalFor(triggerUserId, db),
  ])

  // --- Account maturity ---------------------------------------------------
  if (trigger && ageMinutes(trigger.createdAt) < policy.minTriggerAccountAgeMin) {
    signals.push("trigger_account_too_new")
    score = Math.max(score, policy.reviewScoreThreshold)
  }
  if (beneficiary && ageMinutes(beneficiary.createdAt) < policy.minBeneficiaryAccountAgeMin) {
    signals.push("beneficiary_account_too_new")
    score = Math.max(score, policy.reviewScoreThreshold)
  }

  // --- Cluster / burst signals from hashed device & network data ----------
  if (sig) {
    const counts = await clusterCounts(triggerUserId, sig, db)
    // +1 accounts for the trigger user themselves sharing the signal.
    if (sig.deviceHash && counts.sameDevice + 1 > policy.maxPerDeviceHash) {
      signals.push(`same_device_cluster(${counts.sameDevice + 1})`)
      score = Math.max(score, 90)
    }
    if (sig.ipHash && counts.sameIp + 1 > policy.maxPerIpHash) {
      signals.push(`same_ip_burst(${counts.sameIp + 1})`)
      score = Math.max(score, 60)
    }
    if (sig.subnetHash && counts.sameSubnet + 1 > policy.maxPerSubnetHash) {
      signals.push(`same_subnet_burst(${counts.sameSubnet + 1})`)
      score = Math.max(score, 45)
    }
  }

  const action: RiskEvaluation["action"] =
    score >= policy.blockScoreThreshold
      ? "BLOCKED"
      : score >= policy.reviewScoreThreshold
        ? policy.flaggedAction === "BLOCKED"
          ? "BLOCKED"
          : "PENDING_REVIEW"
        : "AUTO_APPROVED"

  const reason = signals[0] ?? "clean"
  return { score: Math.min(100, Math.round(score)), reason, signals, action }
}
