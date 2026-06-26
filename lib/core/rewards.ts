import { randomBytes } from "crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { creditCashback, creditReferralBonus, ensureWallet } from "./wallet"
import {
  SETTING_KEYS,
  getSetting,
  toBool,
  toNumber,
} from "./settings"

type Tx = Prisma.TransactionClient

/** Generate a short, human-friendly referral code. */
function genCode(): string {
  return randomBytes(4).toString("hex").toUpperCase()
}

/** Return the user's referral code, creating one lazily if absent. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })
  if (user?.referralCode) return user.referralCode

  // Retry on the unlikely unique collision.
  for (let i = 0; i < 5; i++) {
    const code = genCode()
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } })
      return code
    } catch {
      // collision -> try again
    }
  }
  throw new Error("Could not allocate referral code")
}

export interface ReferralStats {
  code: string
  /** Everyone who signed up with this user's code. */
  totalReferred: number
  /** Referred users who have completed their first purchase (stage B paid). */
  rewardedReferred: number
  /** Referred users who joined + passed the gate (stage A paid). */
  joinedReferred: number
  /** Total Toman this user has earned from the referral program (all stages). */
  totalEarned: bigint
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await getOrCreateReferralCode(userId)
  const [totalReferred, rewardedReferred, joinedReferred, earned] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.user.count({ where: { referredById: userId, referralRewarded: true } }),
    prisma.user.count({ where: { referredById: userId, referralJoinRewarded: true } }),
    prisma.walletTransaction.aggregate({
      where: { wallet: { userId }, type: "REFERRAL_BONUS" },
      _sum: { amount: true },
    }),
  ])
  return {
    code,
    totalReferred,
    rewardedReferred,
    joinedReferred,
    totalEarned: earned._sum.amount ?? 0n,
  }
}

/**
 * Attach a referrer to the current user via a referral code. Safe no-op if the
 * user is already referred, the code is unknown, or it's the user's own code.
 */
export async function attachReferral(userId: string, code: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return false

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true, referralCode: true },
  })
  if (!me || me.referredById) return false
  if (me.referralCode === normalized) return false

  const referrer = await prisma.user.findUnique({
    where: { referralCode: normalized },
    select: { id: true },
  })
  if (!referrer || referrer.id === userId) return false

  await prisma.user.update({
    where: { id: userId },
    data: { referredById: referrer.id },
  })
  return true
}

/** Summary returned by reward functions so callers can fire push notifications
 *  AFTER the transaction commits (notifications must never block/rollback). */
export interface ReferralJoinResult {
  rewarded: boolean
  referrerId?: string
  /** Toman credited to the inviter for this join (stage A). */
  bonus?: bigint
  /** Display name of the friend who joined. */
  friendName?: string
}

/**
 * Stage A — "friend joined" reward. Paid once, when a referred user completes
 * onboarding (started the bot and passed the forced-join gate). Idempotent via
 * the `referralJoinRewarded` flag. Runs in its own transaction; returns the
 * payout so the caller can notify the inviter.
 */
export async function rewardReferralJoin(userId: string): Promise<ReferralJoinResult> {
  const enabled = toBool(await getSetting(SETTING_KEYS.referralEnabled))
  if (!enabled) return { rewarded: false }

  const bonus = BigInt(Math.round(toNumber(await getSetting(SETTING_KEYS.referralJoinBonus))))

  return prisma.$transaction(async (tx) => {
    const me = await tx.user.findUnique({
      where: { id: userId },
      select: { referredById: true, referralJoinRewarded: true, displayName: true },
    })
    if (!me?.referredById || me.referralJoinRewarded) return { rewarded: false }

    // Flip the guard first (idempotent against concurrent /start updates).
    await tx.user.update({ where: { id: userId }, data: { referralJoinRewarded: true } })

    if (bonus > 0n) {
      await ensureWallet(me.referredById, tx)
      await creditReferralBonus(me.referredById, bonus, tx, { type: "referral_join", id: userId })
    }
    return { rewarded: true, referrerId: me.referredById, bonus, friendName: me.displayName }
  })
}

/** Per-stage payouts produced by a purchase, for post-commit notifications. */
export interface PurchaseRewardSummary {
  /** Stage B — one-time first-purchase bonus paid to the inviter. */
  firstPurchase?: { referrerId: string; bonus: bigint; friendName: string }
  /** Stage C — recurring commission paid to the inviter on this purchase. */
  commission?: { referrerId: string; amount: bigint; friendName: string }
}

/**
 * Apply purchase-time rewards inside the purchase transaction:
 *  - cashback to the buyer (percent of the charged amount)
 *  - first-purchase referral bonus to both the inviter and the new buyer (stage B)
 *  - lifetime commission to the inviter on every purchase (stage C)
 * All credits run on the same `tx`, so any failure rolls back the purchase.
 * Returns a summary of referral payouts so the caller can notify the inviter
 * once the transaction has committed.
 */
export async function applyPurchaseRewards(
  tx: Tx,
  userId: string,
  orderId: string,
  chargedAmount: bigint,
): Promise<PurchaseRewardSummary> {
  const summary: PurchaseRewardSummary = {}

  // --- Cashback ---
  const cashbackEnabled = toBool(await getSetting(SETTING_KEYS.cashbackEnabled, tx))
  if (cashbackEnabled) {
    const percent = toNumber(await getSetting(SETTING_KEYS.cashbackPercent, tx))
    if (percent > 0) {
      const cashback = (chargedAmount * BigInt(Math.round(percent))) / 100n
      if (cashback > 0n) {
        await ensureWallet(userId, tx)
        await creditCashback(userId, cashback, tx, { type: "order", id: orderId })
      }
    }
  }

  // --- Referral rewards ---
  const referralEnabled = toBool(await getSetting(SETTING_KEYS.referralEnabled, tx))
  if (!referralEnabled) return summary

  const buyer = await tx.user.findUnique({
    where: { id: userId },
    select: { referredById: true, referralRewarded: true, displayName: true },
  })
  if (!buyer?.referredById) return summary
  const referrerId = buyer.referredById

  // Stage C — lifetime commission on EVERY purchase (incl. the first).
  const commissionPercent = toNumber(await getSetting(SETTING_KEYS.referralCommissionPercent, tx))
  if (commissionPercent > 0) {
    const commission = (chargedAmount * BigInt(Math.round(commissionPercent))) / 100n
    if (commission > 0n) {
      await ensureWallet(referrerId, tx)
      await creditReferralBonus(referrerId, commission, tx, { type: "referral_commission", id: orderId })
      summary.commission = { referrerId, amount: commission, friendName: buyer.displayName }
    }
  }

  // Stage B — one-time first-purchase bonus to inviter + new buyer.
  if (!buyer.referralRewarded) {
    // Mark rewarded immediately (idempotent guard against double payout).
    await tx.user.update({ where: { id: userId }, data: { referralRewarded: true } })

    const referrerBonus = BigInt(
      Math.round(toNumber(await getSetting(SETTING_KEYS.referralReferrerBonus, tx))),
    )
    const refereeBonus = BigInt(
      Math.round(toNumber(await getSetting(SETTING_KEYS.referralRefereeBonus, tx))),
    )

    if (referrerBonus > 0n) {
      await ensureWallet(referrerId, tx)
      await creditReferralBonus(referrerId, referrerBonus, tx, { type: "referral", id: userId })
      summary.firstPurchase = { referrerId, bonus: referrerBonus, friendName: buyer.displayName }
    }
    if (refereeBonus > 0n) {
      await ensureWallet(userId, tx)
      await creditReferralBonus(userId, refereeBonus, tx, { type: "referral", id: userId })
    }
  }

  return summary
}
