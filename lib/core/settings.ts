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
} as const

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.cashbackPercent]: "2",
  [SETTING_KEYS.cashbackEnabled]: "true",
  [SETTING_KEYS.referralReferrerBonus]: "50000",
  [SETTING_KEYS.referralRefereeBonus]: "30000",
  [SETTING_KEYS.referralJoinBonus]: "10000",
  [SETTING_KEYS.referralCommissionPercent]: "1",
  [SETTING_KEYS.referralEnabled]: "true",
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
