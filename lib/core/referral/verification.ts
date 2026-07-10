import { prisma } from "@/lib/db"
import { getReferralPolicy } from "./policy"
import { getRelation, advanceStatus, rank } from "./relations"
import { activateSecondLevel } from "./reward"

export interface ChannelVerifiedResult {
  /** Whether this call performed the first channel-verification transition. */
  transitioned: boolean
  /** The direct inviter to notify (only when we just transitioned). */
  notifyInviterId?: string
  /** Display name of the invited user, for the inviter's notification. */
  invitedName?: string
  /** Second-level activation outcome, if it ran. */
  secondLevel?: Awaited<ReturnType<typeof activateSecondLevel>>
}

/**
 * Channel-gate bridge. Call this the moment an invited user passes the mandatory
 * forced-channel gate (bot verify button / web gate). It is the ONLY place a
 * referral becomes "valid":
 *
 *  1. Idempotent — a user with no relation, or one already channel-verified, is
 *     a no-op, so repeated verify callbacks never double-notify or double-reward.
 *  2. Transitions WAITING_FOR_CHANNEL_MEMBERSHIP → CHANNEL_MEMBERSHIP_VERIFIED →
 *     WAITING_FOR_SECOND_LEVEL_ACTIVATION (status-gated, monotonic).
 *  3. Notifies the DIRECT inviter (no reward) when policy allows.
 *  4. Activates the second-level reward flow (this user is a level-2 trigger for
 *     their root inviter) when policy allows.
 *
 * Returns the inviter to notify so the caller (which owns the Telegram/notify
 * layer) can push best-effort notifications AFTER this resolves, keeping the
 * core engine free of transport concerns and avoiding import cycles.
 */
export async function onChannelMembershipVerified(
  userId: string,
): Promise<ChannelVerifiedResult> {
  const policy = await getReferralPolicy()
  if (!policy.enabled) return { transitioned: false }

  const rel = await getRelation(userId)
  if (!rel) return { transitioned: false } // not an invited user
  if (rank(rel.status) >= rank("CHANNEL_MEMBERSHIP_VERIFIED")) {
    // Already verified — still (idempotently) ensure the second-level reward was
    // attempted, in case a prior run failed after the transition.
    let secondLevel
    if (policy.activateSecondLevelOnlyAfterChannelVerification) {
      secondLevel = await activateSecondLevel(userId).catch(() => undefined)
    }
    return { transitioned: false, secondLevel }
  }

  const transitioned = await advanceStatus(userId, "WAITING_FOR_SECOND_LEVEL_ACTIVATION", prisma, {
    channelVerifiedAt: new Date(),
  })
  if (!transitioned) {
    // Lost the race to a concurrent verify — the winner handles side-effects.
    return { transitioned: false }
  }

  const invited = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  })

  // The direct inviter gets a notification only (never a reward).
  const notifyInviterId =
    policy.notifyInviterAfterChannelVerification && policy.directInviteNotification
      ? rel.parentInviterId
      : undefined

  // This verified user triggers the second-level reward for their root inviter.
  let secondLevel
  if (policy.activateSecondLevelOnlyAfterChannelVerification) {
    secondLevel = await activateSecondLevel(userId).catch(() => undefined)
  }

  return {
    transitioned: true,
    notifyInviterId,
    invitedName: invited?.displayName ?? undefined,
    secondLevel,
  }
}
