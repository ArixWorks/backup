// Temporary QA harness for the Level-2 referral engine. Exercises the channel-
// gated acceptance matrix against the real DB, then cleans up everything it made.
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const TAG = "qa_l2_" + Date.now()
const made = { users: [], relations: [], rewards: [], signals: [], wallets: [] }
let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) {
    pass++
    console.log("  PASS:", name)
  } else {
    fail++
    console.log("  FAIL:", name)
  }
}

async function mkUser(alias, ageMin = 1000) {
  const u = await prisma.user.create({
    data: {
      alias: `${TAG}_${alias}`,
      displayName: `${TAG}_${alias}`,
      role: "USER",
      createdAt: new Date(Date.now() - ageMin * 60000),
    },
    select: { id: true },
  })
  made.users.push(u.id)
  return u.id
}

async function main() {
  const {
    getReferralPolicy,
    setReferralPolicy,
    recordRelation,
    onChannelMembershipVerified,
    activateSecondLevel,
  } = await import("../lib/core/referral/index.ts")

  // Deterministic policy for the test (channel gating ON, low review threshold).
  const original = await getReferralPolicy()
  await setReferralPolicy({
    enabled: true,
    requireMandatoryChannelMembership: true,
    notifyInviterAfterChannelVerification: true,
    activateSecondLevelOnlyAfterChannelVerification: true,
    rewardAmount: 20000,
    minTriggerAccountAgeMin: 0,
    rewardCooldownSec: 0,
    maxRewardsPerBeneficiaryPerDay: 0,
    maxPerDeviceHash: 1,
    reviewScoreThreshold: 40,
    blockScoreThreshold: 85,
    flaggedAction: "PENDING_REVIEW",
  })
  const policy = await getReferralPolicy()

  // Chain: A (root) → B (middle) → C (trigger)
  const A = await mkUser("A")
  const B = await mkUser("B")
  const C = await mkUser("C")
  await prisma.user.update({ where: { id: B }, data: { referredById: A } })
  await prisma.user.update({ where: { id: C }, data: { referredById: B } })

  // Attach relations (pending, unverified).
  await recordRelation({ invitedUserId: B, parentInviterId: A, rootInviterId: null, policy })
  await recordRelation({ invitedUserId: C, parentInviterId: B, rootInviterId: A, policy })
  made.relations.push(B, C)

  const relB0 = await prisma.referralRelation.findUnique({ where: { invitedUserId: B } })
  check("attach creates WAITING_FOR_CHANNEL_MEMBERSHIP", relB0.status === "WAITING_FOR_CHANNEL_MEMBERSHIP")

  // 1) C not verified → no reward for A.
  const before = await prisma.referralReward.count({ where: { beneficiaryId: A } })
  check("B->C, C not verified → no reward", before === 0)

  // 2) B passes gate → notify A, still no reward.
  const rB = await onChannelMembershipVerified(B)
  check("B verified transitions", rB.transitioned === true)
  check("B verified notifies inviter A", rB.notifyInviterId === A)
  const afterB = await prisma.referralReward.count({ where: { beneficiaryId: A } })
  check("B verified creates no reward", afterB === 0)

  // 3) C passes gate → Level-2 reward created for A and auto-approved (clean).
  const rC = await onChannelMembershipVerified(C)
  const reward = await prisma.referralReward.findFirst({ where: { beneficiaryId: A } })
  made.rewards.push(reward?.id)
  made.wallets.push(A)
  check("C verified creates L2 reward for A", !!reward)
  check("clean reward auto-approved", reward?.status === "AUTO_APPROVED")
  check("clean reward credited", !!reward?.creditedAt)
  check("verification reports credited", rC.secondLevel?.credited === true)

  // Wallet actually credited.
  const wallet = await prisma.wallet.findFirst({ where: { userId: A } })
  check("wallet credited 20000", wallet && wallet.totalBalance >= 20000n)

  // 4) Idempotency: re-verify C → no duplicate reward.
  await onChannelMembershipVerified(C)
  const count = await prisma.referralReward.count({ where: { beneficiaryId: A } })
  check("re-verify does not duplicate reward", count === 1)

  const { captureSignal } = await import("../lib/core/referral/signals.ts")

  // 5) Same-device cluster (score 90 ≥ block threshold) → BLOCKED (no credit).
  const D = await mkUser("D") // second root
  const E = await mkUser("E") // middle
  const F = await mkUser("F") // trigger, shares a device hash with `other`
  await prisma.user.update({ where: { id: E }, data: { referredById: D } })
  await prisma.user.update({ where: { id: F }, data: { referredById: E } })
  await recordRelation({ invitedUserId: E, parentInviterId: D, rootInviterId: null, policy })
  await recordRelation({ invitedUserId: F, parentInviterId: E, rootInviterId: D, policy })
  made.relations.push(E, F)
  const other = await mkUser("dev_other")
  await captureSignal(other, { source: "telegram", deviceId: `${TAG}_sharedDevice` })
  await captureSignal(F, { source: "telegram", deviceId: `${TAG}_sharedDevice` })
  made.signals.push(other, F)
  await onChannelMembershipVerified(E)
  const rF = await onChannelMembershipVerified(F)
  const rewardD = await prisma.referralReward.findFirst({ where: { beneficiaryId: D } })
  made.rewards.push(rewardD?.id)
  check("same-device cluster → BLOCKED", rewardD?.status === "BLOCKED")
  check("blocked reward NOT credited", !rewardD?.creditedAt)
  check("blocked verification not credited", !rF.secondLevel?.credited)

  // 6) Same-IP burst (score 60 → review threshold) → PENDING_REVIEW, then admin
  //    approve credits it.
  const G = await mkUser("G") // third root
  const H = await mkUser("H") // middle
  const I = await mkUser("I") // trigger, shares an IP hash with 3 others
  await prisma.user.update({ where: { id: H }, data: { referredById: G } })
  await prisma.user.update({ where: { id: I }, data: { referredById: H } })
  await recordRelation({ invitedUserId: H, parentInviterId: G, rootInviterId: null, policy })
  await recordRelation({ invitedUserId: I, parentInviterId: H, rootInviterId: G, policy })
  made.relations.push(H, I)
  // maxPerIpHash is 3 → need > 3 distinct users on the IP (incl. I = +1).
  for (let n = 0; n < 3; n++) {
    const u = await mkUser(`ip_other_${n}`)
    await captureSignal(u, { source: "web", ip: "203.0.113.7", userAgent: "ua" })
    made.signals.push(u)
  }
  await captureSignal(I, { source: "web", ip: "203.0.113.7", userAgent: "ua" })
  made.signals.push(I)
  await onChannelMembershipVerified(H)
  const rI = await onChannelMembershipVerified(I)
  const rewardG = await prisma.referralReward.findFirst({ where: { beneficiaryId: G } })
  made.rewards.push(rewardG?.id)
  check("same-ip burst → PENDING_REVIEW", rewardG?.status === "PENDING_REVIEW")
  check("review reward NOT auto-credited", !rewardG?.creditedAt)
  check("review verification not credited", !rI.secondLevel?.credited)

  const { approveReward } = await import("../lib/core/referral/reward.ts")
  const admin = await mkUser("admin")
  const ok = await approveReward(rewardG.id, admin)
  const rewardG2 = await prisma.referralReward.findUnique({ where: { id: rewardG.id } })
  check("admin approve credits reward", ok && rewardG2.status === "APPROVED" && !!rewardG2.creditedAt)

  // restore original policy
  await setReferralPolicy(original)

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`)
}

async function cleanup() {
  const ids = made.users
  await prisma.referralReward.deleteMany({ where: { beneficiaryId: { in: ids } } }).catch(() => {})
  await prisma.referralRiskSignal.deleteMany({ where: { subjectUserId: { in: ids } } }).catch(() => {})
  await prisma.referralRelation.deleteMany({ where: { invitedUserId: { in: ids } } }).catch(() => {})
  // Wallet + WalletTransaction + AuditLog(actor) cascade / null on user delete.
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.log("cleanup users:", e.message))
}

main()
  .catch((e) => {
    console.error("QA error:", e)
    fail++
  })
  .finally(async () => {
    await cleanup()
    await prisma.$disconnect()
    process.exit(fail > 0 ? 1 : 0)
  })
