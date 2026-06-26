import { randomBytes } from "crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { creditCashback, creditReferralBonus, ensureWallet } from "./wallet"
import { earnPoints, addSpend, progressMission, awardBadge } from "./gamification"
import { audit } from "./audit"
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

export interface ReferralListItem {
  /** Masked display name to avoid leaking full identities of invitees. */
  name: string
  joinedAt: Date
  /** "pending" (signed up), "joined" (stage A), "purchased" (stage B). */
  stage: "pending" | "joined" | "purchased"
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
  /** Most recent invitees for the dashboard activity list. */
  recent: ReferralListItem[]
}

/** Mask a display name as "علی ر..." so the inviter sees progress but not PII. */
function maskName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "کاربر"
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return parts[0].length <= 3 ? parts[0] : `${parts[0].slice(0, 3)}…`
  }
  return `${parts[0]} ${parts[1].slice(0, 1)}…`
}

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await getOrCreateReferralCode(userId)
  const [totalReferred, rewardedReferred, joinedReferred, earned, recentRows] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.user.count({ where: { referredById: userId, referralRewarded: true } }),
    prisma.user.count({ where: { referredById: userId, referralJoinRewarded: true } }),
    prisma.walletTransaction.aggregate({
      where: { wallet: { userId }, type: "REFERRAL_BONUS" },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      where: { referredById: userId },
      select: {
        displayName: true,
        createdAt: true,
        referralRewarded: true,
        referralJoinRewarded: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])
  const recent: ReferralListItem[] = recentRows.map((r) => ({
    name: maskName(r.displayName ?? ""),
    joinedAt: r.createdAt,
    stage: r.referralRewarded ? "purchased" : r.referralJoinRewarded ? "joined" : "pending",
  }))
  return {
    code,
    totalReferred,
    rewardedReferred,
    joinedReferred,
    totalEarned: earned._sum.amount ?? 0n,
    recent,
  }
}

export interface AdminReferralOverview {
  totalReferredUsers: number
  totalConverted: number
  totalPaidOut: string
  topReferrers: {
    id: string
    name: string
    count: number
    converted: number
    earned: string
  }[]
  fraudFlags: {
    id: string
    actorName: string
    reason: string
    createdAt: Date
  }[]
}

/** Program-wide referral analytics for the admin dashboard. */
export async function getReferralAdminOverview(): Promise<AdminReferralOverview> {
  const [grouped, totalReferredUsers, totalConverted, paid, flags] = await Promise.all([
    // Count of referees per inviter.
    prisma.user.groupBy({
      by: ["referredById"],
      where: { referredById: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { referredById: "desc" } },
      take: 10,
    }),
    prisma.user.count({ where: { referredById: { not: null } } }),
    prisma.user.count({ where: { referredById: { not: null }, referralRewarded: true } }),
    prisma.walletTransaction.aggregate({
      where: { type: "REFERRAL_BONUS" },
      _sum: { amount: true },
    }),
    prisma.auditLog.findMany({
      where: { action: "REFERRAL_FRAUD_FLAGGED" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { displayName: true, alias: true } } },
    }),
  ])

  const ids = grouped.map((g) => g.referredById!).filter(Boolean)
  const inviters = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, alias: true },
  })
  const inviterMap = new Map(inviters.map((u) => [u.id, u]))

  // Earnings + conversions per top inviter.
  const topReferrers = await Promise.all(
    grouped.map(async (g) => {
      const id = g.referredById!
      const [converted, earned] = await Promise.all([
        prisma.user.count({ where: { referredById: id, referralRewarded: true } }),
        prisma.walletTransaction.aggregate({
          where: { wallet: { userId: id }, type: "REFERRAL_BONUS" },
          _sum: { amount: true },
        }),
      ])
      const u = inviterMap.get(id)
      return {
        id,
        name: u?.displayName ?? u?.alias ?? "کاربر",
        count: g._count._all,
        converted,
        earned: (earned._sum.amount ?? 0n).toString(),
      }
    }),
  )

  return {
    totalReferredUsers,
    totalConverted,
    totalPaidOut: (paid._sum.amount ?? 0n).toString(),
    topReferrers,
    fraudFlags: flags.map((f) => ({
      id: f.id,
      actorName: f.actor?.displayName ?? f.actor?.alias ?? "ناشناس",
      reason:
        (f.meta as { reason?: string } | null)?.reason ?? "unknown",
      createdAt: f.createdAt,
    })),
  }
}

export type AttachReferralReason =
  | "ok"
  | "empty"
  | "already_referred"
  | "self_code"
  | "unknown_code"
  | "loop" // the target already lists me as their inviter (two-way loop)
  | "account_too_new"
  | "inviter_cap_reached"

export interface AttachReferralResult {
  attached: boolean
  reason: AttachReferralReason
}

/**
 * Attach a referrer to the current user via a referral code, enforcing
 * lightweight anti-fraud rules:
 *  - no self-referral (own code)
 *  - no two-way loops (you can't credit someone you already referred)
 *  - optional minimum account age before a code can be attached
 *  - optional per-inviter cap on counted referrals
 * Suspicious attempts are recorded in the audit log. Safe no-op (returns a
 * reason) when the attach is rejected.
 */
export async function attachReferral(userId: string, code: string): Promise<AttachReferralResult> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return { attached: false, reason: "empty" }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true, referralCode: true, createdAt: true },
  })
  if (!me || me.referredById) return { attached: false, reason: "already_referred" }
  if (me.referralCode === normalized) return { attached: false, reason: "self_code" }

  const referrer = await prisma.user.findUnique({
    where: { referralCode: normalized },
    select: { id: true, referredById: true },
  })
  if (!referrer || referrer.id === userId) return { attached: false, reason: "unknown_code" }

  // Loop guard: reject if the inviter was themselves referred by this user.
  if (referrer.referredById === userId) {
    await audit({
      actorId: userId,
      action: "REFERRAL_FRAUD_FLAGGED",
      entity: "referral",
      entityId: referrer.id,
      meta: { reason: "loop", code: normalized },
    }).catch(() => {})
    return { attached: false, reason: "loop" }
  }

  // Minimum account-age gate.
  const minAgeMin = toNumber(await getSetting(SETTING_KEYS.referralMinAccountAgeMin))
  if (minAgeMin > 0) {
    const ageMin = (Date.now() - me.createdAt.getTime()) / 60000
    if (ageMin < minAgeMin) return { attached: false, reason: "account_too_new" }
  }

  // Per-inviter cap on total referred users.
  const maxPerUser = toNumber(await getSetting(SETTING_KEYS.referralMaxPerUser))
  if (maxPerUser > 0) {
    const current = await prisma.user.count({ where: { referredById: referrer.id } })
    if (current >= maxPerUser) {
      await audit({
        actorId: userId,
        action: "REFERRAL_FRAUD_FLAGGED",
        entity: "referral",
        entityId: referrer.id,
        meta: { reason: "inviter_cap_reached", code: normalized, cap: maxPerUser },
      }).catch(() => {})
      return { attached: false, reason: "inviter_cap_reached" }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { referredById: referrer.id },
  })
  return { attached: true, reason: "ok" }
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

  // --- Loyalty points & VIP spend (always runs, independent of referral) ---
  const loyaltyEnabled = toBool(await getSetting(SETTING_KEYS.loyaltyEnabled, tx))
  if (loyaltyEnabled) {
    // Award points proportional to spend, then track lifetime spend for VIP.
    const perThousand = toNumber(await getSetting(SETTING_KEYS.pointsPerThousand, tx))
    if (perThousand > 0) {
      const pts = Math.floor((Number(chargedAmount) / 1000) * perThousand)
      if (pts > 0) await earnPoints(userId, pts, "PURCHASE", { type: "order", id: orderId }, tx)
    }
    await addSpend(userId, chargedAmount, tx)
    await progressMission(userId, "MAKE_PURCHASE", 1, tx)
    // First-purchase achievement (idempotent).
    await awardBadge(userId, "FIRST_PURCHASE", tx)
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

    // Loyalty rewards for the inviter on a successful (converted) referral.
    if (loyaltyEnabled) {
      const refPoints = toNumber(await getSetting(SETTING_KEYS.pointsPerReferral, tx))
      if (refPoints > 0) {
        await earnPoints(referrerId, refPoints, "REFERRAL", { type: "referral", id: userId }, tx)
      }
      await progressMission(referrerId, "INVITE_FRIEND", 1, tx)
      await awardBadge(referrerId, "FIRST_REFERRAL", tx)
    }
    if (refereeBonus > 0n) {
      await ensureWallet(userId, tx)
      await creditReferralBonus(userId, refereeBonus, tx, { type: "referral", id: userId })
    }
  }

  return summary
}
