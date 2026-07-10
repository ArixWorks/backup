/**
 * Referral Level-2 engine — end-to-end acceptance QA harness.
 *
 * Exercises the REAL engine functions (attachReferral, onChannelMembershipVerified,
 * activateSecondLevel, approve/reject/block, processPendingReferralRewards) against
 * the live (shared) database. Expectations are derived from the ACTIVE policy so we
 * never mutate the production setting. All fixtures are tagged `qa-l2-` and removed
 * with `--clean`.
 *
 *   pnpm exec tsx scripts/qa-referral-l2.ts          # seed + run assertions
 *   pnpm exec tsx scripts/qa-referral-l2.ts --clean  # remove all qa-l2 fixtures
 */
import { PrismaClient } from "@prisma/client"
import { attachReferral, getOrCreateReferralCode } from "@/lib/core/rewards"
import { onChannelMembershipVerified } from "@/lib/core/referral/verification"
import { activateSecondLevel, approveReward, rejectReward, blockReward } from "@/lib/core/referral/reward"
import { getReferralPolicy } from "@/lib/core/referral/policy"
import { getRelation } from "@/lib/core/referral/relations"
import { captureSignal } from "@/lib/core/referral/signals"
import { getBalances, ensureWallet } from "@/lib/core/wallet"
import type { RiskContext } from "@/lib/core/referral/types"

const prisma = new PrismaClient()
const TAG = "qa-l2"

let pass = 0
let fail = 0
const failures: string[] = []
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

let seq = 0
async function mkUser(label: string, ageMinutes: number): Promise<string> {
  seq++
  const createdAt = new Date(Date.now() - ageMinutes * 60_000)
  const u = await prisma.user.create({
    data: {
      displayName: `QA L2 ${label}`,
      alias: `${TAG}-${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt,
    },
    select: { id: true },
  })
  return u.id
}

async function balance(userId: string): Promise<bigint> {
  try {
    return (await getBalances(userId)).totalBalance
  } catch {
    return -1n
  }
}

async function rewardFor(beneficiaryId: string, triggerUserId: string) {
  return prisma.referralReward.findUnique({
    where: { triggerKey: `L2:${beneficiaryId}:${triggerUserId}` },
  })
}

/** Build a verified A→B chain, returning ids. B is channel-verified. */
async function attach(inviterId: string, invitedId: string, ctx?: RiskContext) {
  const code = await getOrCreateReferralCode(inviterId)
  return attachReferral(invitedId, code, ctx)
}

async function run() {
  const policy = await getReferralPolicy()
  console.log("\n=== ACTIVE REFERRAL POLICY (expectations derived from this) ===")
  console.log(
    JSON.stringify(
      {
        enabled: policy.enabled,
        secondLevelReward: policy.secondLevelReward,
        rewardAmount: policy.rewardAmount,
        currency: policy.currency,
        requireMandatoryChannelMembership: policy.requireMandatoryChannelMembership,
        notifyInviterAfterChannelVerification: policy.notifyInviterAfterChannelVerification,
        minTriggerAccountAgeMin: policy.minTriggerAccountAgeMin,
        rewardCooldownSec: policy.rewardCooldownSec,
        maxPerDeviceHash: policy.maxPerDeviceHash,
        reviewScoreThreshold: policy.reviewScoreThreshold,
        blockScoreThreshold: policy.blockScoreThreshold,
        flaggedAction: policy.flaggedAction,
      },
      null,
      2,
    ),
  )

  if (!policy.enabled) {
    console.log("Policy disabled — enabling scenarios cannot run. Aborting.")
    return
  }

  const amt = BigInt(Math.round(policy.rewardAmount))
  const oldAge = Math.max(policy.minTriggerAccountAgeMin, policy.minBeneficiaryAccountAgeMin) + 120

  // ---------------------------------------------------------------------------
  // Scenario 1 — attach only: no immediate reward, relation WAITING, no notify.
  // ---------------------------------------------------------------------------
  console.log("\n[1] Direct invite (attach) creates no reward, relation waits for channel gate")
  {
    const A = await mkUser("S1-A", oldAge)
    const B = await mkUser("S1-B", oldAge)
    const res = await attach(A, B, { source: "web", ip: "10.1.1.1", userAgent: "qa/1", deviceId: `${TAG}-s1-B` })
    check("attach A→B succeeds", res.attached, res.reason)
    const relB = await getRelation(B)
    const expected = policy.requireMandatoryChannelMembership
      ? "WAITING_FOR_CHANNEL_MEMBERSHIP"
      : "CHANNEL_MEMBERSHIP_VERIFIED"
    check(`relation B = ${expected}`, relB?.status === expected, relB?.status)
    const anyReward = await prisma.referralReward.findFirst({ where: { beneficiaryId: A } })
    check("no reward created on attach", anyReward === null)
  }

  // ---------------------------------------------------------------------------
  // Scenario 2 — A→B, B passes channel gate: notify A only, NO reward.
  // ---------------------------------------------------------------------------
  console.log("\n[2] B passes channel gate → inviter A notified, still NO reward (direct invite)")
  let notifyOnlyA = ""
  {
    const A = await mkUser("S2-A", oldAge)
    const B = await mkUser("S2-B", oldAge)
    notifyOnlyA = A
    await attach(A, B, { source: "web", ip: "10.2.2.2", userAgent: "qa/2", deviceId: `${TAG}-s2-B` })
    const r = await onChannelMembershipVerified(B)
    check("B verification transitioned", r.transitioned)
    check(
      "direct inviter A flagged for notification",
      policy.notifyInviterAfterChannelVerification ? r.notifyInviterId === A : r.notifyInviterId === undefined,
      r.notifyInviterId,
    )
    const relB = await getRelation(B)
    check(
      "relation B ≥ CHANNEL_MEMBERSHIP_VERIFIED",
      ["CHANNEL_MEMBERSHIP_VERIFIED", "WAITING_FOR_SECOND_LEVEL_ACTIVATION", "SECOND_LEVEL_TRIGGERED"].includes(
        relB?.status ?? "",
      ),
      relB?.status,
    )
    const anyReward = await prisma.referralReward.findFirst({ where: { beneficiaryId: A } })
    check("still NO reward after direct invite verified", anyReward === null)
  }

  // ---------------------------------------------------------------------------
  // Scenario 3 — full clean chain A→B→C, C verified: L2 reward for A AUTO-approved + credited.
  // ---------------------------------------------------------------------------
  console.log("\n[3] Clean A→B→C, C passes gate → L2 reward for A auto-approves + wallet credit")
  {
    const A = await mkUser("S3-A", oldAge)
    const B = await mkUser("S3-B", oldAge)
    const C = await mkUser("S3-C", oldAge)
    await attach(A, B, { source: "web", ip: "10.3.0.1", userAgent: "qa/3a", deviceId: `${TAG}-s3-B` })
    await attach(B, C, { source: "web", ip: "10.3.0.2", userAgent: "qa/3b", deviceId: `${TAG}-s3-C` })
    await ensureWallet(A)
    const before = await balance(A)
    await onChannelMembershipVerified(B) // B must be verified first
    const r = await onChannelMembershipVerified(C) // C triggers A's L2 reward
    const rew = await rewardFor(A, C)
    check("L2 reward row created for A (trigger C)", !!rew, rew?.status)
    check("reward beneficiary = A", rew?.beneficiaryId === A)
    check("reward middle = B", rew?.middleUserId === B)
    check("reward status AUTO_APPROVED", rew?.status === "AUTO_APPROVED", rew?.status)
    check("reward creditedAt set", !!rew?.creditedAt)
    check("reward amount = policy.rewardAmount", rew?.amount === amt, `${rew?.amount} vs ${amt}`)
    const after = await balance(A)
    check("wallet credited by exactly rewardAmount", after - before === amt, `${before} → ${after}`)
    check("secondLevel.credited flag true", r.secondLevel?.credited === true)
    // Wallet-only path: a REFERRAL_BONUS tx exists for A.
    const tx = await prisma.walletTransaction.findFirst({
      where: { wallet: { userId: A }, type: "REFERRAL_BONUS" },
    })
    check("wallet credit went through Wallet engine (REFERRAL_BONUS tx)", !!tx)
  }

  // ---------------------------------------------------------------------------
  // Scenario 4 — B→C where C does NOT pass the gate: no L2 reward.
  // ---------------------------------------------------------------------------
  console.log("\n[4] C does NOT pass channel gate → no L2 reward for A, no wallet movement")
  {
    const A = await mkUser("S4-A", oldAge)
    const B = await mkUser("S4-B", oldAge)
    const C = await mkUser("S4-C", oldAge)
    await attach(A, B, { source: "web", ip: "10.4.0.1", userAgent: "qa/4a", deviceId: `${TAG}-s4-B` })
    await attach(B, C, { source: "web", ip: "10.4.0.2", userAgent: "qa/4b", deviceId: `${TAG}-s4-C` })
    await onChannelMembershipVerified(B) // only B verified, not C
    const rew = await rewardFor(A, C)
    check("no L2 reward while C unverified", rew === null)
  }

  // ---------------------------------------------------------------------------
  // Scenario 5 — suspicious (young trigger account) → PENDING_REVIEW, no credit.
  // ---------------------------------------------------------------------------
  console.log("\n[5] Suspicious (immature trigger) → PENDING_REVIEW, no auto-credit")
  let pendingRewardId = ""
  let pendingBeneficiary = ""
  if (policy.minTriggerAccountAgeMin > 0) {
    const A = await mkUser("S5-A", oldAge)
    const B = await mkUser("S5-B", oldAge)
    const C = await mkUser("S5-C-young", 1) // below minTriggerAccountAgeMin
    await attach(A, B, { source: "web", ip: "10.5.0.1", userAgent: "qa/5a", deviceId: `${TAG}-s5-B` })
    await attach(B, C, { source: "web", ip: "10.5.0.2", userAgent: "qa/5b", deviceId: `${TAG}-s5-C` })
    await ensureWallet(A)
    const before = await balance(A)
    await onChannelMembershipVerified(B)
    await onChannelMembershipVerified(C)
    const rew = await rewardFor(A, C)
    check("reward created", !!rew)
    check("reward status PENDING_REVIEW (immature)", rew?.status === "PENDING_REVIEW", rew?.status)
    check("no credit while pending", !rew?.creditedAt)
    check("wallet unchanged while pending", (await balance(A)) === before)
    pendingRewardId = rew?.id ?? ""
    pendingBeneficiary = A
  } else {
    console.log("  SKIP  minTriggerAccountAgeMin=0 → maturity gate disabled")
  }

  // ---------------------------------------------------------------------------
  // Scenario 6 — high-confidence abuse (same-device cluster) → BLOCKED.
  // ---------------------------------------------------------------------------
  console.log("\n[6] Same-device cluster abuse → BLOCKED, no credit")
  {
    const A = await mkUser("S6-A", oldAge)
    const B = await mkUser("S6-B", oldAge)
    const C = await mkUser("S6-C", oldAge)
    const sharedDevice = `${TAG}-s6-shared-device`
    // Pre-pollute the device cluster with extra distinct users beyond the cap.
    const extras = policy.maxPerDeviceHash + 1
    for (let i = 0; i < extras; i++) {
      const x = await mkUser(`S6-decoy-${i}`, oldAge)
      await captureSignal(x, { source: "web", deviceId: sharedDevice })
    }
    await attach(A, B, { source: "web", ip: "10.6.0.1", userAgent: "qa/6a", deviceId: `${TAG}-s6-B` })
    await attach(B, C, { source: "web", ip: "10.6.0.2", userAgent: "qa/6b", deviceId: sharedDevice })
    await ensureWallet(A)
    const before = await balance(A)
    await onChannelMembershipVerified(B)
    await onChannelMembershipVerified(C)
    const rew = await rewardFor(A, C)
    check("reward created", !!rew)
    // device cluster pushes score to 90 → BLOCKED when blockScoreThreshold<=90.
    const expected = 90 >= policy.blockScoreThreshold ? "BLOCKED" : "PENDING_REVIEW"
    check(`reward status ${expected} (device cluster, score≈90)`, rew?.status === expected, `${rew?.status} score=${rew?.riskScore}`)
    check("no credit for abusive reward", !rew?.creditedAt)
    check("wallet unchanged for abusive chain", (await balance(A)) === before)
  }

  // ---------------------------------------------------------------------------
  // Scenario 7 — replay / duplicate verify: exactly one reward, credited once.
  // ---------------------------------------------------------------------------
  console.log("\n[7] Repeated channel-verify callbacks → no duplicate reward, credited once")
  {
    const A = await mkUser("S7-A", oldAge)
    const B = await mkUser("S7-B", oldAge)
    const C = await mkUser("S7-C", oldAge)
    await attach(A, B, { source: "web", ip: "10.7.0.1", userAgent: "qa/7a", deviceId: `${TAG}-s7-B` })
    await attach(B, C, { source: "web", ip: "10.7.0.2", userAgent: "qa/7b", deviceId: `${TAG}-s7-C` })
    await ensureWallet(A)
    const before = await balance(A)
    await onChannelMembershipVerified(B)
    // Fire the C verification 5x (bot + web double-fire simulation).
    await Promise.all([
      onChannelMembershipVerified(C),
      onChannelMembershipVerified(C),
      onChannelMembershipVerified(C),
      onChannelMembershipVerified(C),
      onChannelMembershipVerified(C),
    ])
    const rewards = await prisma.referralReward.findMany({ where: { beneficiaryId: A, triggerUserId: C } })
    check("exactly ONE reward row despite 5 callbacks", rewards.length === 1, `count=${rewards.length}`)
    const after = await balance(A)
    const credited = rewards[0]?.status === "AUTO_APPROVED"
    check("wallet credited at most once", after - before === (credited ? amt : 0n), `${before} → ${after}`)
  }

  // ---------------------------------------------------------------------------
  // Scenario 8 — admin approve a PENDING_REVIEW reward → credits once.
  // ---------------------------------------------------------------------------
  console.log("\n[8] Admin approve pending reward → wallet credited")
  if (pendingRewardId && pendingBeneficiary) {
    const admin = await mkUser("S8-admin", oldAge)
    const before = await balance(pendingBeneficiary)
    const ok = await approveReward(pendingRewardId, admin)
    check("approveReward returns true", ok)
    const rew = await prisma.referralReward.findUnique({ where: { id: pendingRewardId } })
    check("reward status APPROVED", rew?.status === "APPROVED", rew?.status)
    check("reward creditedAt set", !!rew?.creditedAt)
    check("wallet credited on approve", (await balance(pendingBeneficiary)) - before === amt)
    // Re-approve must not double-credit.
    const before2 = await balance(pendingBeneficiary)
    await approveReward(pendingRewardId, admin).catch(() => {})
    check("re-approve does not double-credit", (await balance(pendingBeneficiary)) === before2)
  } else {
    console.log("  SKIP  no pending reward available from scenario 5")
  }

  // ---------------------------------------------------------------------------
  // Scenario 9 — admin reject a PENDING_REVIEW reward → no credit.
  // ---------------------------------------------------------------------------
  console.log("\n[9] Admin reject pending reward → no credit")
  if (policy.minTriggerAccountAgeMin > 0) {
    const A = await mkUser("S9-A", oldAge)
    const B = await mkUser("S9-B", oldAge)
    const C = await mkUser("S9-C-young", 1)
    await attach(A, B, { source: "web", ip: "10.9.0.1", userAgent: "qa/9a", deviceId: `${TAG}-s9-B` })
    await attach(B, C, { source: "web", ip: "10.9.0.2", userAgent: "qa/9b", deviceId: `${TAG}-s9-C` })
    await ensureWallet(A)
    await onChannelMembershipVerified(B)
    await onChannelMembershipVerified(C)
    const rew = await rewardFor(A, C)
    const before = await balance(A)
    const admin = await mkUser("S9-admin", oldAge)
    const ok = await rejectReward(rew!.id, admin, "qa reject")
    check("rejectReward returns true", ok)
    const after = await prisma.referralReward.findUnique({ where: { id: rew!.id } })
    check("reward status REJECTED", after?.status === "REJECTED", after?.status)
    check("no credit on reject", !after?.creditedAt)
    check("wallet unchanged on reject", (await balance(A)) === before)
  } else {
    console.log("  SKIP  maturity gate disabled")
  }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`)
  if (fail) console.log("Failed:", failures.join("; "))
}

async function clean() {
  const users = await prisma.user.findMany({ where: { alias: { startsWith: `${TAG}-` } }, select: { id: true } })
  const ids = users.map((u) => u.id)
  console.log(`Cleaning ${ids.length} qa-l2 users + dependent rows…`)
  if (ids.length) {
    await prisma.referralReward.deleteMany({
      where: { OR: [{ beneficiaryId: { in: ids } }, { triggerUserId: { in: ids } }, { middleUserId: { in: ids } }] },
    })
    await prisma.referralRiskSignal.deleteMany({ where: { subjectUserId: { in: ids } } })
    await prisma.referralRelation.deleteMany({
      where: { OR: [{ invitedUserId: { in: ids } }, { parentInviterId: { in: ids } }, { rootInviterId: { in: ids } }] },
    })
    // WalletTransaction cascades with Wallet; ledger legs reference system
    // LedgerAccounts (not user wallets), so wallet deletion is FK-safe.
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } })
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }).catch(() => {})
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {})
    await prisma.user.updateMany({ where: { referredById: { in: ids } }, data: { referredById: null } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  }
  console.log("Clean complete.")
}

async function main() {
  try {
    if (process.argv.includes("--clean")) await clean()
    else await run()
  } finally {
    await prisma.$disconnect()
  }
}
void main()
