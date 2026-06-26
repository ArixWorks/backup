import "server-only"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { createNotification } from "./notifications"
import {
  SETTING_KEYS,
  getSetting,
  getAllSettings,
  toBool,
  toNumber,
} from "./settings"

type Tx = Prisma.TransactionClient
type Db = typeof prisma | Tx

// VIP tiers in ascending order. Index doubles as the rank.
export const VIP_TIERS = ["STANDARD", "SILVER", "GOLD", "PLATINUM", "VIP"] as const
export type VipTier = (typeof VIP_TIERS)[number]

export const VIP_TIER_LABELS: Record<VipTier, string> = {
  STANDARD: "استاندارد",
  SILVER: "نقره‌ای",
  GOLD: "طلایی",
  PLATINUM: "پلاتینیوم",
  VIP: "وی‌آی‌پی",
}

export function vipRank(tier: VipTier): number {
  return VIP_TIERS.indexOf(tier)
}

// ---------------------------------------------------------------------------
// Period helpers (UTC-based, stable per day / ISO week)
// ---------------------------------------------------------------------------

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

export function weekKey(d = new Date()): string {
  // ISO-8601 week number.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    )
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

export type PointReason =
  | "PURCHASE"
  | "REFERRAL"
  | "GIVEAWAY_ENTRY"
  | "DAILY_LOGIN"
  | "PROFILE_COMPLETE"
  | "MISSION_REWARD"
  | "ACHIEVEMENT"
  | "ADMIN_ADJUSTMENT"
  | "REDEEM"

/**
 * Append a points entry and update the user's spendable + lifetime balances.
 * Positive earnings increase lifetimePoints (which drives VIP tier); negative
 * adjustments (redemptions) do not reduce lifetimePoints. Recomputes the VIP
 * tier afterwards. Returns the new spendable balance.
 */
export async function earnPoints(
  userId: string,
  delta: number,
  reason: PointReason,
  ref?: { type?: string; id?: string; note?: string },
  db: Db = prisma,
): Promise<{ balance: number }> {
  if (!Number.isFinite(delta) || delta === 0) {
    const u = await db.user.findUnique({ where: { id: userId }, select: { loyaltyPoints: true } })
    return { balance: u?.loyaltyPoints ?? 0 }
  }

  const user = await db.user.update({
    where: { id: userId },
    data: {
      loyaltyPoints: { increment: delta },
      // lifetimePoints only ever grows; redemptions/penalties don't lower it.
      ...(delta > 0 ? { lifetimePoints: { increment: delta } } : {}),
    },
    select: { loyaltyPoints: true },
  })

  await db.pointLedger.create({
    data: {
      userId,
      delta,
      balanceAfter: user.loyaltyPoints,
      reason,
      refType: ref?.type ?? null,
      refId: ref?.id ?? null,
      note: ref?.note ?? null,
    },
  })

  await recomputeVipTier(userId, db)
  return { balance: user.loyaltyPoints }
}

// ---------------------------------------------------------------------------
// VIP tiers (combined points + spend, admin-configurable thresholds)
// ---------------------------------------------------------------------------

type TierThresholds = { points: number; spend: number }

async function tierThresholds(db: Db): Promise<Record<Exclude<VipTier, "STANDARD">, TierThresholds>> {
  const [sp, gp, pp, vp, ss, gs, ps, vs] = await Promise.all([
    getSetting(SETTING_KEYS.vipSilverPoints, db as typeof prisma),
    getSetting(SETTING_KEYS.vipGoldPoints, db as typeof prisma),
    getSetting(SETTING_KEYS.vipPlatinumPoints, db as typeof prisma),
    getSetting(SETTING_KEYS.vipVipPoints, db as typeof prisma),
    getSetting(SETTING_KEYS.vipSilverSpend, db as typeof prisma),
    getSetting(SETTING_KEYS.vipGoldSpend, db as typeof prisma),
    getSetting(SETTING_KEYS.vipPlatinumSpend, db as typeof prisma),
    getSetting(SETTING_KEYS.vipVipSpend, db as typeof prisma),
  ])
  return {
    SILVER: { points: toNumber(sp), spend: toNumber(ss) },
    GOLD: { points: toNumber(gp), spend: toNumber(gs) },
    PLATINUM: { points: toNumber(pp), spend: toNumber(ps) },
    VIP: { points: toNumber(vp), spend: toNumber(vs) },
  }
}

/**
 * Combined tier rule: a user qualifies for a tier when they meet EITHER its
 * lifetime-points threshold OR its lifetime-spend threshold. The resulting
 * tier is the highest one for which either metric qualifies, so each metric
 * contributes independently ("combined" criteria).
 */
export function tierFor(
  lifetimePoints: number,
  totalSpent: bigint,
  thresholds: Record<Exclude<VipTier, "STANDARD">, TierThresholds>,
): VipTier {
  const spend = Number(totalSpent)
  let tier: VipTier = "STANDARD"
  for (const t of ["SILVER", "GOLD", "PLATINUM", "VIP"] as const) {
    const th = thresholds[t]
    if (lifetimePoints >= th.points || spend >= th.spend) tier = t
  }
  return tier
}

/**
 * Recompute and persist the user's VIP tier from their lifetime points and
 * spend. Only ever promotes (never silently demotes on threshold edits within
 * a session); emits a notification on upgrade. Returns upgrade info.
 */
export async function recomputeVipTier(
  userId: string,
  db: Db = prisma,
): Promise<{ tier: VipTier; upgraded: boolean; previous: VipTier }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { lifetimePoints: true, totalSpent: true, vipTier: true },
  })
  if (!user) return { tier: "STANDARD", upgraded: false, previous: "STANDARD" }

  const thresholds = await tierThresholds(db)
  const computed = tierFor(user.lifetimePoints, user.totalSpent, thresholds)
  const previous = user.vipTier as VipTier

  if (vipRank(computed) > vipRank(previous)) {
    await db.user.update({
      where: { id: userId },
      data: { vipTier: computed, vipSince: new Date() },
    })
    await createNotification(
      {
        userId,
        type: "VIP_UPGRADED",
        title: "ارتقای سطح عضویت",
        body: `تبریک! سطح عضویت شما به ${VIP_TIER_LABELS[computed]} ارتقا یافت.`,
        href: "/rewards",
      },
      db,
    ).catch(() => {})
    // Grant the VIP-member achievement when reaching the top tier.
    if (computed === "VIP") await awardBadge(userId, "VIP_MEMBER", db).catch(() => {})
    return { tier: computed, upgraded: true, previous }
  }
  return { tier: previous, upgraded: false, previous }
}

/** Record lifetime spend (IRT) and recompute VIP tier. */
export async function addSpend(userId: string, amount: bigint, db: Db = prisma): Promise<void> {
  if (amount <= 0n) return
  await db.user.update({ where: { id: userId }, data: { totalSpent: { increment: amount } } })
  await recomputeVipTier(userId, db)
}

// ---------------------------------------------------------------------------
// Badges / achievements
// ---------------------------------------------------------------------------

/**
 * Idempotently award a badge. On first award it grants the badge's bonus
 * points and an in-app notification. Safe to call repeatedly.
 */
export async function awardBadge(userId: string, badgeCode: string, db: Db = prisma): Promise<boolean> {
  const badge = await db.badge.findUnique({ where: { code: badgeCode } })
  if (!badge || !badge.isActive) return false

  try {
    await db.userBadge.create({ data: { userId, badgeCode } })
  } catch {
    return false // already owned (unique constraint)
  }

  if (badge.points > 0) {
    await earnPoints(userId, badge.points, "ACHIEVEMENT", { type: "badge", id: badgeCode }, db)
  }
  await createNotification(
    {
      userId,
      type: "BADGE_AWARDED",
      title: "نشان جدید",
      body: `نشان «${badge.name}» را دریافت کردید.`,
      href: "/rewards",
    },
    db,
  ).catch(() => {})
  return true
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

function periodKeyFor(kind: "DAILY" | "WEEKLY"): string {
  return kind === "DAILY" ? dayKey() : weekKey()
}

/**
 * Advance progress on all active missions of a given activity type for the
 * current period, completing them when the target is reached. Idempotent per
 * call increment; returns the missions that just completed.
 */
export async function progressMission(
  userId: string,
  type: Prisma.MissionWhereInput["type"],
  amount = 1,
  db: Db = prisma,
): Promise<{ completed: { id: string; title: string; rewardPoints: number }[] }> {
  const missions = await db.mission.findMany({ where: { type, isActive: true } })
  const completed: { id: string; title: string; rewardPoints: number }[] = []

  for (const m of missions) {
    const periodKey = periodKeyFor(m.kind)
    const existing = await db.userMission.findUnique({
      where: { userId_missionId_periodKey: { userId, missionId: m.id, periodKey } },
    })
    if (existing?.completedAt) continue

    const progress = Math.min((existing?.progress ?? 0) + amount, m.target)
    const justCompleted = progress >= m.target
    await db.userMission.upsert({
      where: { userId_missionId_periodKey: { userId, missionId: m.id, periodKey } },
      create: {
        userId,
        missionId: m.id,
        periodKey,
        progress,
        completedAt: justCompleted ? new Date() : null,
      },
      update: { progress, completedAt: justCompleted ? new Date() : null },
    })
    if (justCompleted) completed.push({ id: m.id, title: m.title, rewardPoints: m.rewardPoints })
  }

  return { completed }
}

/**
 * Claim the reward for a completed-but-unclaimed mission in the current period.
 * Grants the mission's reward points exactly once.
 */
export async function claimMission(
  userId: string,
  missionId: string,
  db: Db = prisma,
): Promise<{ ok: boolean; points: number; reason?: string }> {
  const mission = await db.mission.findUnique({ where: { id: missionId } })
  if (!mission) return { ok: false, points: 0, reason: "not_found" }
  const periodKey = periodKeyFor(mission.kind)

  const um = await db.userMission.findUnique({
    where: { userId_missionId_periodKey: { userId, missionId, periodKey } },
  })
  if (!um?.completedAt) return { ok: false, points: 0, reason: "not_completed" }
  if (um.claimedAt) return { ok: false, points: 0, reason: "already_claimed" }

  await db.userMission.update({
    where: { id: um.id },
    data: { claimedAt: new Date() },
  })
  if (mission.rewardPoints > 0) {
    await earnPoints(userId, mission.rewardPoints, "MISSION_REWARD", { type: "mission", id: missionId }, db)
  }
  return { ok: true, points: mission.rewardPoints }
}

// ---------------------------------------------------------------------------
// Daily login + profile completion
// ---------------------------------------------------------------------------

/**
 * Count a daily login once per UTC day: award login points, maintain the
 * streak, and progress the DAILY_LOGIN mission. No-op if already counted today.
 */
export async function recordDailyLogin(userId: string): Promise<{ counted: boolean; streak: number }> {
  const enabled = toBool(await getSetting(SETTING_KEYS.loyaltyEnabled))
  const today = dayKey()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastLoginDay: true, loginStreak: true },
  })
  if (!user) return { counted: false, streak: 0 }
  if (user.lastLoginDay === today) return { counted: false, streak: user.loginStreak }

  // Continue the streak only if the last login was exactly yesterday.
  const yesterday = dayKey(new Date(Date.now() - 86400000))
  const streak = user.lastLoginDay === yesterday ? user.loginStreak + 1 : 1

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginDay: today, loginStreak: streak },
  })

  if (enabled) {
    const pts = toNumber(await getSetting(SETTING_KEYS.pointsDailyLogin))
    if (pts > 0) await earnPoints(userId, pts, "DAILY_LOGIN", { type: "login", id: today })
    await progressMission(userId, "DAILY_LOGIN", 1)
  }
  return { counted: true, streak }
}

/**
 * Mark the profile complete once required fields are present; grants the
 * profile-completion points and progresses the COMPLETE_PROFILE mission.
 */
export async function checkProfileCompletion(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileCompleted: true, displayName: true, email: true, photoUrl: true },
  })
  if (!user || user.profileCompleted) return false
  const complete = Boolean(user.displayName && user.email && user.photoUrl)
  if (!complete) return false

  await prisma.user.update({ where: { id: userId }, data: { profileCompleted: true } })
  if (toBool(await getSetting(SETTING_KEYS.loyaltyEnabled))) {
    const pts = toNumber(await getSetting(SETTING_KEYS.pointsProfileComplete))
    if (pts > 0) await earnPoints(userId, pts, "PROFILE_COMPLETE", { type: "profile", id: userId })
    await progressMission(userId, "COMPLETE_PROFILE", 1)
  }
  await awardBadge(userId, "PROFILE_COMPLETE")
  return true
}

// ---------------------------------------------------------------------------
// Read model for the rewards UI
// ---------------------------------------------------------------------------

export async function getGamificationSummary(userId: string) {
  const settings = await getAllSettings()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      loyaltyPoints: true,
      lifetimePoints: true,
      totalSpent: true,
      vipTier: true,
      vipSince: true,
      loginStreak: true,
    },
  })
  if (!user) return null

  const thresholds: Record<Exclude<VipTier, "STANDARD">, TierThresholds> = {
    SILVER: { points: toNumber(settings[SETTING_KEYS.vipSilverPoints]), spend: toNumber(settings[SETTING_KEYS.vipSilverSpend]) },
    GOLD: { points: toNumber(settings[SETTING_KEYS.vipGoldPoints]), spend: toNumber(settings[SETTING_KEYS.vipGoldSpend]) },
    PLATINUM: { points: toNumber(settings[SETTING_KEYS.vipPlatinumPoints]), spend: toNumber(settings[SETTING_KEYS.vipPlatinumSpend]) },
    VIP: { points: toNumber(settings[SETTING_KEYS.vipVipPoints]), spend: toNumber(settings[SETTING_KEYS.vipVipSpend]) },
  }

  const tier = user.vipTier as VipTier
  const rank = vipRank(tier)
  const nextTier = rank < VIP_TIERS.length - 1 ? VIP_TIERS[rank + 1] : null
  const nextThreshold = nextTier && nextTier !== "STANDARD" ? thresholds[nextTier] : null

  return {
    loyaltyPoints: user.loyaltyPoints,
    lifetimePoints: user.lifetimePoints,
    totalSpent: user.totalSpent.toString(),
    tier,
    tierLabel: VIP_TIER_LABELS[tier],
    vipSince: user.vipSince,
    loginStreak: user.loginStreak,
    nextTier,
    nextTierLabel: nextTier ? VIP_TIER_LABELS[nextTier] : null,
    nextThreshold,
    thresholds,
  }
}
