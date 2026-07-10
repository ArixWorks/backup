import type { Prisma, ReferralRelationStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { ReferralPolicy } from "./policy"

type Db = Prisma.TransactionClient | typeof prisma

/** Monotonic ordering of the relation lifecycle, for status-gated transitions. */
const ORDER: Record<ReferralRelationStatus, number> = {
  WAITING_FOR_CHANNEL_MEMBERSHIP: 0,
  CHANNEL_MEMBERSHIP_VERIFIED: 1,
  WAITING_FOR_SECOND_LEVEL_ACTIVATION: 2,
  SECOND_LEVEL_TRIGGERED: 3,
}

export function rank(status: ReferralRelationStatus): number {
  return ORDER[status]
}

/**
 * Create (or leave untouched) the relation row for an invited user. Idempotent
 * on `invitedUserId`. The initial status depends on whether the mandatory
 * channel gate is enforced by policy:
 *   - enforced  → WAITING_FOR_CHANNEL_MEMBERSHIP (invite not yet valid)
 *   - not enforced (fallback) → CHANNEL_MEMBERSHIP_VERIFIED (immediately valid)
 * The direct inviter's id is `parentInviterId`; the root inviter (parent's
 * inviter) is `rootInviterId`. Both are scalar ids (no self-relation FK) so a
 * partial restore can never dangle.
 */
export async function recordRelation(
  args: {
    invitedUserId: string
    parentInviterId: string
    rootInviterId: string | null
    policy: ReferralPolicy
  },
  db: Db = prisma,
) {
  const initial: ReferralRelationStatus = args.policy.requireMandatoryChannelMembership
    ? "WAITING_FOR_CHANNEL_MEMBERSHIP"
    : "CHANNEL_MEMBERSHIP_VERIFIED"

  return db.referralRelation.upsert({
    where: { invitedUserId: args.invitedUserId },
    create: {
      invitedUserId: args.invitedUserId,
      parentInviterId: args.parentInviterId,
      rootInviterId: args.rootInviterId,
      level: 1,
      status: initial,
      channelVerifiedAt: initial === "CHANNEL_MEMBERSHIP_VERIFIED" ? new Date() : null,
    },
    // Never regress an existing relation; attach is a one-time record.
    update: {},
  })
}

export async function getRelation(invitedUserId: string, db: Db = prisma) {
  return db.referralRelation.findUnique({ where: { invitedUserId } })
}

/**
 * Advance a relation to (at least) the target status, only if it is currently
 * behind it. Returns true when THIS call performed the transition (so callers
 * can fire side-effects exactly once). Status-gated `updateMany` makes repeated
 * verify callbacks safe under concurrency.
 */
export async function advanceStatus(
  invitedUserId: string,
  target: ReferralRelationStatus,
  db: Db = prisma,
  extra: Prisma.ReferralRelationUpdateManyMutationInput = {},
): Promise<boolean> {
  const behind = (Object.keys(ORDER) as ReferralRelationStatus[]).filter(
    (s) => ORDER[s] < ORDER[target],
  )
  const res = await db.referralRelation.updateMany({
    where: { invitedUserId, status: { in: behind } },
    data: { status: target, ...extra },
  })
  return res.count === 1
}
