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
import {
  EARNED_TIERS,
  THRESHOLD_TIERS,
  TIER_META,
  TIER_ORDER,
  tierRank as tierRankShared,
  effectiveTier as computeEffectiveTier,
  isVipActive,
  normalizeEarnedTier,
  type EarnedTier,
  type ThresholdTier,
  type Tier,
} from "@/lib/tiers"

type Tx = Prisma.TransactionClient
type Db = typeof prisma | Tx

// Earned ladder (the auto engine only ever assigns one of these). Re-exported
// for backward compatibility with existing imports.
export const VIP_TIERS = EARNED_TIERS
export type VipTier = EarnedTier

/** Persian labels for every tier (including VIP), sourced from TIER_META. */
export const VIP_TIER_LABELS = Object.fromEntries(
  TIER_ORDER.map((t) => [t, TIER_META[t].label]),
) as Record<Tier, string>

export function vipRank(tier: Tier): number {
  return tierRankShared(tier)
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
type ThresholdMap = Record<ThresholdTier, TierThresholds>

async function tierThresholds(db: Db): Promise<ThresholdMap> {
  const [bp, sp, gp, dp, bs, ss, gs, ds] = await Promise.all([
    getSetting(SETTING_KEYS.vipBronzePoints, db as typeof prisma),
    getSetting(SETTING_KEYS.vipSilverPoints, db as typeof prisma),
    getSetting(SETTING_KEYS.vipGoldPoints, db as typeof prisma),
    getSetting(SETTING_KEYS.vipDiamondPoints, db as typeof prisma),
    getSetting(SETTING_KEYS.vipBronzeSpend, db as typeof prisma),
    getSetting(SETTING_KEYS.vipSilverSpend, db as typeof prisma),
    getSetting(SETTING_KEYS.vipGoldSpend, db as typeof prisma),
    getSetting(SETTING_KEYS.vipDiamondSpend, db as typeof prisma),
  ])
  return {
    BRONZE: { points: toNumber(bp), spend: toNumber(bs) },
    SILVER: { points: toNumber(sp), spend: toNumber(ss) },
    GOLD: { points: toNumber(gp), spend: toNumber(gs) },
    DIAMOND: { points: toNumber(dp), spend: toNumber(ds) },
  }
}

/**
 * Combined tier rule: a user qualifies for a tier when they meet EITHER its
 * lifetime-points threshold OR its lifetime-spend threshold. The resulting
 * earned tier is the highest one for which either metric qualifies, so each
 * metric contributes independently ("combined" criteria). VIP is never
 * auto-assigned — it is an exclusive admin grant layered on top.
 */
export function tierFor(
  lifetimePoints: number,
  totalSpent: bigint,
  thresholds: ThresholdMap,
): EarnedTier {
  const spend = Number(totalSpent)
  let tier: EarnedTier = "STANDARD"
  for (const t of THRESHOLD_TIERS) {
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
): Promise<{ tier: EarnedTier; upgraded: boolean; previous: EarnedTier }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { lifetimePoints: true, totalSpent: true, vipTier: true },
  })
  if (!user) return { tier: "STANDARD", upgraded: false, previous: "STANDARD" }

  const thresholds = await tierThresholds(db)
  const computed = tierFor(user.lifetimePoints, user.totalSpent, thresholds)
  // Compare against the normalized earned tier (legacy PLATINUM/VIP -> DIAMOND).
  const previous = normalizeEarnedTier(user.vipTier)

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
    // Reaching the top earned tier grants the elite achievement (idempotent).
    if (computed === "DIAMOND") await awardBadge(userId, "VIP_MEMBER", db).catch(() => {})
    return { tier: computed, upgraded: true, previous }
  }
  return { tier: previous, upgraded: false, previous }
}

// ---------------------------------------------------------------------------
// Exclusive VIP membership (admin-granted) + tier discounts
// ---------------------------------------------------------------------------

/** Resolve a user's effective tier (VIP when an active manual grant exists). */
export async function getEffectiveTier(userId: string, db: Db = prisma): Promise<Tier> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { vipTier: true, vipManual: true, vipManualExpiresAt: true },
  })
  if (!user) return "STANDARD"
  return computeEffectiveTier(user)
}

/** Settings key holding the discount percent for a given effective tier. */
function discountKeyFor(tier: Tier): string | null {
  switch (tier) {
    case "BRONZE":
      return SETTING_KEYS.tierDiscountBronze
    case "SILVER":
      return SETTING_KEYS.tierDiscountSilver
    case "GOLD":
      return SETTING_KEYS.tierDiscountGold
    case "DIAMOND":
      return SETTING_KEYS.tierDiscountDiamond
    case "VIP":
      return SETTING_KEYS.tierDiscountVip
    default:
      return null // STANDARD has no discount
  }
}

/** Product discount percent (0-100) for an effective tier, clamped. */
export async function tierDiscountPercent(tier: Tier, db: Db = prisma): Promise<number> {
  const key = discountKeyFor(tier)
  if (!key) return 0
  const pct = toNumber(await getSetting(key, db as typeof prisma))
  return Math.max(0, Math.min(100, pct))
}

/**
 * Grant the exclusive VIP membership to a user. Optionally expires at a date
 * (after which the user reverts to their earned tier automatically). Emits an
 * in-app notification. Idempotent-friendly: re-granting just updates expiry.
 */
export async function grantVip(
  userId: string,
  expiresAt: Date | null,
  db: Db = prisma,
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { vipManual: true, vipManualExpiresAt: expiresAt, vipSince: new Date() },
  })
  await awardBadge(userId, "VIP_MEMBER", db).catch(() => {})
  await createNotification(
    {
      userId,
      type: "VIP_UPGRADED",
      title: "عضویت ویژه VIP",
      body: "عضویت اختصاصی VIP برای شما فعال شد. از مزایای ویژه بهره‌مند شوید!",
      href: "/rewards",
    },
    db,
  ).catch(() => {})
}

/** Revoke the exclusive VIP membership; the user reverts to their earned tier. */
export async function revokeVip(userId: string, db: Db = prisma): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { vipManual: false, vipManualExpiresAt: null },
  })
  await createNotification(
    {
      userId,
      type: "VIP_UPGRADED",
      title: "پایان عضویت ویژه",
      body: "عضویت اختصاصی VIP شما به پایان رسید.",
      href: "/rewards",
    },
    db,
  ).catch(() => {})
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

  // Insert with ON CONFLICT DO NOTHING (skipDuplicates). A plain `create` that
  // hit the (userId, badgeCode) unique constraint would THROW, and inside a
  // SERIALIZABLE transaction that aborts the entire tx in Postgres (25P02) —
  // poisoning every subsequent query even though we catch the error here. This
  // previously made a user's *second* purchase fail with a 500 once they
  // already owned the badge. createMany+skipDuplicates never raises, so the
  // surrounding purchase transaction stays healthy.
  const inserted = await db.userBadge.createMany({
    data: [{ userId, badgeCode }],
    skipDuplicates: true,
  })
  if (inserted.count === 0) return false // already owned

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
      vipManual: true,
      vipManualExpiresAt: true,
      loginStreak: true,
    },
  })
  if (!user) return null

  const thresholds: ThresholdMap = {
    BRONZE: { points: toNumber(settings[SETTING_KEYS.vipBronzePoints]), spend: toNumber(settings[SETTING_KEYS.vipBronzeSpend]) },
    SILVER: { points: toNumber(settings[SETTING_KEYS.vipSilverPoints]), spend: toNumber(settings[SETTING_KEYS.vipSilverSpend]) },
    GOLD: { points: toNumber(settings[SETTING_KEYS.vipGoldPoints]), spend: toNumber(settings[SETTING_KEYS.vipGoldSpend]) },
    DIAMOND: { points: toNumber(settings[SETTING_KEYS.vipDiamondPoints]), spend: toNumber(settings[SETTING_KEYS.vipDiamondSpend]) },
  }

  // Earned tier (auto) vs effective tier (VIP overrides when active).
  const earnedTier = normalizeEarnedTier(user.vipTier)
  const vipActive = isVipActive(user)
  const effective = computeEffectiveTier(user)

  // Progress is always toward the next EARNED tier (VIP is not earnable).
  const earnedRank = vipRank(earnedTier)
  const nextTier =
    earnedRank < EARNED_TIERS.length - 1 ? EARNED_TIERS[earnedRank + 1] : null
  const nextThreshold =
    nextTier && nextTier !== "STANDARD" ? thresholds[nextTier as ThresholdTier] : null

  const discountPercent = await tierDiscountPercent(effective)

  return {
    loyaltyPoints: user.loyaltyPoints,
    lifetimePoints: user.lifetimePoints,
    totalSpent: user.totalSpent.toString(),
    // `tier`/`tierLabel` reflect the EFFECTIVE tier shown across the app.
    tier: effective,
    tierLabel: VIP_TIER_LABELS[effective],
    earnedTier,
    earnedTierLabel: VIP_TIER_LABELS[earnedTier],
    vipActive,
    vipManualExpiresAt: user.vipManualExpiresAt,
    discountPercent,
    vipSince: user.vipSince,
    loginStreak: user.loginStreak,
    nextTier,
    nextTierLabel: nextTier ? VIP_TIER_LABELS[nextTier] : null,
    nextThreshold,
    thresholds,
  }
}

/**
 * All active badges merged with the user's earned state, ordered for display.
 * Locked badges are shown too (greyed in the UI) to advertise what's available.
 */
export async function listBadgesForUser(userId: string) {
  const [badges, earned] = await Promise.all([
    prisma.badge.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" } }),
    prisma.userBadge.findMany({ where: { userId } }),
  ])
  const earnedMap = new Map(earned.map((e) => [e.badgeCode, e.awardedAt]))
  return badges.map((b) => ({
    code: b.code,
    name: b.name,
    description: b.description,
    icon: b.icon,
    points: b.points,
    earned: earnedMap.has(b.code),
    awardedAt: earnedMap.get(b.code) ?? null,
  }))
}

/**
 * Active missions for the current period with the user's progress/claim state.
 */
export async function listMissionsForUser(userId: string) {
  const missions = await prisma.mission.findMany({
    where: { isActive: true },
    orderBy: [{ kind: "asc" }, { displayOrder: "asc" }],
  })
  const periodKeys = Array.from(new Set(missions.map((m) => periodKeyFor(m.kind))))
  const progress = await prisma.userMission.findMany({
    where: { userId, periodKey: { in: periodKeys } },
  })
  const byMission = new Map(progress.map((p) => [`${p.missionId}:${p.periodKey}`, p]))

  return missions.map((m) => {
    const periodKey = periodKeyFor(m.kind)
    const um = byMission.get(`${m.id}:${periodKey}`)
    return {
      id: m.id,
      key: m.key,
      kind: m.kind,
      title: m.title,
      description: m.description,
      icon: m.icon,
      href: m.href,
      target: m.target,
      rewardPoints: m.rewardPoints,
      progress: Math.min(um?.progress ?? 0, m.target),
      completed: Boolean(um?.completedAt),
      claimed: Boolean(um?.claimedAt),
    }
  })
}

/** Recent points-ledger entries for the rewards activity feed. */
export async function listPointHistory(userId: string, limit = 30) {
  const rows = await prisma.pointLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows.map((r) => ({
    id: r.id,
    delta: r.delta,
    balanceAfter: r.balanceAfter,
    reason: r.reason,
    note: r.note,
    createdAt: r.createdAt,
  }))
}
