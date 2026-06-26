import { prisma } from "@/lib/db"

/**
 * Typed accessors over the key-value `Setting` table. Values are stored as
 * strings; helpers coerce to number/bool. Defaults are used when a key is unset.
 */

export const SETTING_KEYS = {
  cashbackPercent: "cashback.percent", // 0..100, percent of each purchase
  cashbackEnabled: "cashback.enabled", // "true" | "false"
  referralReferrerBonus: "referral.referrerBonus", // stage B: inviter, first purchase (Toman)
  referralRefereeBonus: "referral.refereeBonus", // stage B: new user, first purchase (Toman)
  referralJoinBonus: "referral.joinBonus", // stage A: inviter, friend joined + passed gate (Toman)
  referralCommissionPercent: "referral.commissionPercent", // stage C: inviter, % of every friend purchase
  referralEnabled: "referral.enabled", // "true" | "false"

  // --- Gamification ---
  loyaltyEnabled: "loyalty.enabled", // "true" | "false"
  // Points earned per 1000 Toman spent on a purchase.
  pointsPerThousand: "loyalty.pointsPerThousand",
  pointsPerReferral: "loyalty.pointsPerReferral", // points to inviter per successful referral
  pointsPerGiveawayEntry: "loyalty.pointsPerGiveawayEntry",
  pointsDailyLogin: "loyalty.pointsDailyLogin",
  pointsProfileComplete: "loyalty.pointsProfileComplete",
  // Lifetime-points thresholds for each VIP tier (combined with spend thresholds).
  vipSilverPoints: "vip.silver.points",
  vipGoldPoints: "vip.gold.points",
  vipPlatinumPoints: "vip.platinum.points",
  vipVipPoints: "vip.vip.points",
  // Lifetime-spend thresholds (Toman) for each VIP tier.
  vipSilverSpend: "vip.silver.spend",
  vipGoldSpend: "vip.gold.spend",
  vipPlatinumSpend: "vip.platinum.spend",
  vipVipSpend: "vip.vip.spend",
} as const

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.cashbackPercent]: "2",
  [SETTING_KEYS.cashbackEnabled]: "true",
  [SETTING_KEYS.referralReferrerBonus]: "50000",
  [SETTING_KEYS.referralRefereeBonus]: "30000",
  [SETTING_KEYS.referralJoinBonus]: "10000",
  [SETTING_KEYS.referralCommissionPercent]: "1",
  [SETTING_KEYS.referralEnabled]: "true",

  // Gamification defaults (Toman amounts; tiers combine points AND spend).
  [SETTING_KEYS.loyaltyEnabled]: "true",
  [SETTING_KEYS.pointsPerThousand]: "1", // 1 point per 1,000 Toman spent
  [SETTING_KEYS.pointsPerReferral]: "100",
  [SETTING_KEYS.pointsPerGiveawayEntry]: "5",
  [SETTING_KEYS.pointsDailyLogin]: "10",
  [SETTING_KEYS.pointsProfileComplete]: "50",
  [SETTING_KEYS.vipSilverPoints]: "500",
  [SETTING_KEYS.vipGoldPoints]: "2000",
  [SETTING_KEYS.vipPlatinumPoints]: "5000",
  [SETTING_KEYS.vipVipPoints]: "15000",
  [SETTING_KEYS.vipSilverSpend]: "1000000", // 1M Toman
  [SETTING_KEYS.vipGoldSpend]: "5000000",
  [SETTING_KEYS.vipPlatinumSpend]: "20000000",
  [SETTING_KEYS.vipVipSpend]: "50000000",
}

type Db = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export async function getSetting(key: string, db: Db = prisma): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } })
  return row?.value ?? DEFAULTS[key] ?? ""
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany()
  const map: Record<string, string> = { ...DEFAULTS }
  for (const r of rows) map[r.key] = r.value
  return map
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

export async function setSettings(entries: Record<string, string>): Promise<void> {
  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  )
}

export function toNumber(value: string, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function toBool(value: string): boolean {
  return value === "true" || value === "1"
}
