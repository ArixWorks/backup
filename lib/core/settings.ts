import { cache } from "react"
import { unstable_cache, revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"

/**
 * Tag shared by every cross-request settings cache entry. Any settings write
 * calls `invalidateSettingsCache()` so readers pick up the new value on the
 * next request instead of serving a stale snapshot.
 */
export const SETTINGS_CACHE_TAG = "app-settings"

/**
 * Invalidate all cached settings reads. Safe to call from route handlers and
 * server actions; wrapped so it can't throw when invoked outside a request
 * (e.g. cron/background scripts).
 */
export function invalidateSettingsCache(): void {
  try {
    revalidateTag(SETTINGS_CACHE_TAG, "max")
  } catch {
    /* not in a revalidate-capable context (script/worker) — ignore */
  }
}

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
  // Anti-fraud: max successful referrals counted per inviter (0 = unlimited).
  referralMaxPerUser: "referral.maxPerUser",
  // Anti-fraud: minimum account age (minutes) before a user may attach a code.
  referralMinAccountAgeMin: "referral.minAccountAgeMin",

  // --- Gamification ---
  loyaltyEnabled: "loyalty.enabled", // "true" | "false"
  // Points earned per 1000 Toman spent on a purchase.
  pointsPerThousand: "loyalty.pointsPerThousand",
  pointsPerReferral: "loyalty.pointsPerReferral", // points to inviter per successful referral
  pointsPerGiveawayEntry: "loyalty.pointsPerGiveawayEntry",
  pointsDailyLogin: "loyalty.pointsDailyLogin",
  pointsProfileComplete: "loyalty.pointsProfileComplete",
  // Lifetime-points thresholds for each earned tier (combined with spend).
  vipBronzePoints: "vip.bronze.points",
  vipSilverPoints: "vip.silver.points",
  vipGoldPoints: "vip.gold.points",
  vipDiamondPoints: "vip.diamond.points",
  // Lifetime-spend thresholds (Toman) for each earned tier.
  vipBronzeSpend: "vip.bronze.spend",
  vipSilverSpend: "vip.silver.spend",
  vipGoldSpend: "vip.gold.spend",
  vipDiamondSpend: "vip.diamond.spend",
  // Per-tier product discount (percent). The user's tier discount and any
  // coupon do NOT stack — the larger of the two is applied at checkout.
  tierDiscountBronze: "tier.discount.bronze",
  tierDiscountSilver: "tier.discount.silver",
  tierDiscountGold: "tier.discount.gold",
  tierDiscountDiamond: "tier.discount.diamond",
  tierDiscountVip: "tier.discount.vip",

  // --- Top-up payment methods (admin-configured) ---
  payCardEnabled: "pay.card.enabled", // "true" | "false"
  payCardNumber: "pay.card.number", // 16-digit card number for card-to-card
  payCardHolder: "pay.card.holder", // card holder full name
  payCardBank: "pay.card.bank", // bank name (display only)
  payUsdtEnabled: "pay.usdt.enabled",
  payUsdtAddress: "pay.usdt.address",
  payUsdtNetwork: "pay.usdt.network", // BEP20 / TRC20
  payTonEnabled: "pay.ton.enabled",
  payTonAddress: "pay.ton.address",
  payStarsEnabled: "pay.stars.enabled",
  payMinToman: "pay.min.toman", // minimum top-up amount in Toman

  // --- Appearance ---
  themeActive: "theme.active", // one of THEME_IDS, applied to <html data-theme>

  // --- Automated backups ---
  backupEnabled: "backup.enabled", // "true" | "false" — daily auto-backup on/off
  backupChatId: "backup.chatId", // Telegram chat id the backup file is sent to
  backupHour: "backup.hour", // 0..23, hour (Asia/Tehran) the daily backup fires
  backupLastRunDate: "backup.lastRunDate", // internal: YYYY-MM-DD (Tehran) of last run

  // --- Email infrastructure ---
  emailEnabled: "email.enabled", // master switch for outbound email
  emailFromName: "email.fromName", // display name on the From header
  emailDomain: "email.domain", // verified sending domain, e.g. "subio.shop"
  emailNoreplyAddress: "email.address.noreply", // full address or local part
  emailSupportAddress: "email.address.support",
  emailBillingAddress: "email.address.billing",
  emailSecurityAddress: "email.address.security",
  emailReplyTo: "email.replyTo", // optional Reply-To for transactional mail
  emailBlockDisposable: "email.blockDisposable", // reject disposable inboxes
  emailRatePerMinute: "email.ratePerMinute", // outgoing send cap per minute (flood guard)
  emailBatchSize: "email.batchSize", // jobs processed per worker tick
  emailMaxAttempts: "email.maxAttempts", // default retry ceiling per job
  emailOpenTracking: "email.openTracking", // request open tracking from provider
  emailClickTracking: "email.clickTracking", // request click tracking from provider

  // --- Maintenance mode ---
  // When enabled, regular users are blocked (bot + web/Mini App) and shown a
  // friendly "under maintenance" notice. Admins are never affected.
  maintenanceEnabled: "maintenance.enabled", // "true" | "false"
  maintenanceTitle: "maintenance.title", // short headline
  maintenanceMessage: "maintenance.message", // body text shown to users
  maintenanceSupportUrl: "maintenance.supportUrl", // optional support link (t.me/...)
} as const

/** Admin-selectable visual themes. The `id` maps to `data-theme` on <html>. */
export const THEMES = [
  {
    id: "gold",
    label: "طلایی سینمایی",
    description: "سرمه‌ای عمیق با لهجه طلایی لوکس",
    swatch: ["#caa23f", "#f0d878", "#1a1d24"],
    // Exact sRGB of this theme's --background (oklch(0.155 0.014 252)) so the
    // browser/Telegram chrome matches the app body with no color seam.
    headerColor: "#080d12",
  },
  {
    id: "aurora",
    label: "آرورا",
    description: "مشکی نیلی با لهجه بنفش الکتریک تا فیروزه‌ای",
    swatch: ["#8b5cf6", "#22d3ee", "#16131f"],
    // Exact sRGB of this theme's --background (oklch(0.145 0.022 280)).
    headerColor: "#080913",
  },
] as const

export type ThemeId = (typeof THEMES)[number]["id"]
export const THEME_IDS = THEMES.map((t) => t.id) as ThemeId[]
export const DEFAULT_THEME: ThemeId = "gold"

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as string[]).includes(value)
}

const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.cashbackPercent]: "2",
  [SETTING_KEYS.cashbackEnabled]: "true",
  [SETTING_KEYS.referralReferrerBonus]: "50000",
  [SETTING_KEYS.referralRefereeBonus]: "30000",
  [SETTING_KEYS.referralJoinBonus]: "10000",
  [SETTING_KEYS.referralCommissionPercent]: "1",
  [SETTING_KEYS.referralEnabled]: "true",
  [SETTING_KEYS.referralMaxPerUser]: "0", // unlimited by default
  [SETTING_KEYS.referralMinAccountAgeMin]: "0", // no delay by default

  // Gamification defaults (Toman amounts; tiers combine points AND spend).
  [SETTING_KEYS.loyaltyEnabled]: "true",
  [SETTING_KEYS.pointsPerThousand]: "1", // 1 point per 1,000 Toman spent
  [SETTING_KEYS.pointsPerReferral]: "100",
  [SETTING_KEYS.pointsPerGiveawayEntry]: "5",
  [SETTING_KEYS.pointsDailyLogin]: "10",
  [SETTING_KEYS.pointsProfileComplete]: "50",
  [SETTING_KEYS.vipBronzePoints]: "200",
  [SETTING_KEYS.vipSilverPoints]: "500",
  [SETTING_KEYS.vipGoldPoints]: "2000",
  [SETTING_KEYS.vipDiamondPoints]: "5000",
  [SETTING_KEYS.vipBronzeSpend]: "300000", // 300K Toman
  [SETTING_KEYS.vipSilverSpend]: "1000000", // 1M Toman
  [SETTING_KEYS.vipGoldSpend]: "5000000",
  [SETTING_KEYS.vipDiamondSpend]: "20000000",
  // Modest, sustainable tier discounts (percent).
  [SETTING_KEYS.tierDiscountBronze]: "1",
  [SETTING_KEYS.tierDiscountSilver]: "2",
  [SETTING_KEYS.tierDiscountGold]: "3",
  [SETTING_KEYS.tierDiscountDiamond]: "5",
  [SETTING_KEYS.tierDiscountVip]: "10",

  // Top-up methods: card on by default, crypto/stars off until admin configures.
  [SETTING_KEYS.payCardEnabled]: "true",
  [SETTING_KEYS.payCardNumber]: "",
  [SETTING_KEYS.payCardHolder]: "",
  [SETTING_KEYS.payCardBank]: "",
  [SETTING_KEYS.payUsdtEnabled]: "false",
  [SETTING_KEYS.payUsdtAddress]: "",
  [SETTING_KEYS.payUsdtNetwork]: "BEP20",
  [SETTING_KEYS.payTonEnabled]: "false",
  [SETTING_KEYS.payTonAddress]: "",
  [SETTING_KEYS.payStarsEnabled]: "false",
  [SETTING_KEYS.payMinToman]: "10000",

  [SETTING_KEYS.themeActive]: DEFAULT_THEME,

  // Daily backup: enabled, sent to the owner's chat at 00:00 Asia/Tehran.
  [SETTING_KEYS.backupEnabled]: "true",
  [SETTING_KEYS.backupChatId]: "1645353710",
  [SETTING_KEYS.backupHour]: "0",
  [SETTING_KEYS.backupLastRunDate]: "",

  // Email: enabled by default; addresses default to local parts that combine
  // with `email.domain` (or RESEND_FROM's domain) at send time. Conservative
  // rate limit and batch size keep the provider happy and avoid floods.
  [SETTING_KEYS.emailEnabled]: "true",
  [SETTING_KEYS.emailFromName]: "Subio Shop",
  [SETTING_KEYS.emailDomain]: "",
  [SETTING_KEYS.emailNoreplyAddress]: "noreply",
  [SETTING_KEYS.emailSupportAddress]: "support",
  [SETTING_KEYS.emailBillingAddress]: "billing",
  [SETTING_KEYS.emailSecurityAddress]: "security",
  [SETTING_KEYS.emailReplyTo]: "",
  [SETTING_KEYS.emailBlockDisposable]: "false",
  [SETTING_KEYS.emailRatePerMinute]: "60",
  [SETTING_KEYS.emailBatchSize]: "25",
  [SETTING_KEYS.emailMaxAttempts]: "5",
  [SETTING_KEYS.emailOpenTracking]: "true",
  [SETTING_KEYS.emailClickTracking]: "true",

  // Maintenance: off by default with a professional, reassuring notice.
  [SETTING_KEYS.maintenanceEnabled]: "false",
  [SETTING_KEYS.maintenanceTitle]: "به‌زودی برمی‌گردیم",
  [SETTING_KEYS.maintenanceMessage]:
    "در حال ارتقای سیستم برای ارائه تجربه‌ای سریع‌تر و بهتر هستیم. لطفاً چند دقیقه دیگر دوباره سر بزنید. از صبر و همراهی شما سپاسگزاریم.",
  [SETTING_KEYS.maintenanceSupportUrl]: "",
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
  invalidateSettingsCache()
}

export async function setSettings(entries: Record<string, string>): Promise<void> {
  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
    ),
  )
  invalidateSettingsCache()
}

export function toNumber(value: string, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function toBool(value: string): boolean {
  return value === "true" || value === "1"
}

/** Returns the active theme id, falling back to the default when unset/invalid. */
export async function getActiveTheme(db: Db = prisma): Promise<ThemeId> {
  const value = await getSetting(SETTING_KEYS.themeActive, db)
  return isThemeId(value) ? value : DEFAULT_THEME
}

/**
 * Cross-request cached active-theme reader for the render hot path (root
 * layout). The theme changes only when an admin picks a new one, so we cache
 * it under the shared settings tag and let `invalidateSettingsCache()` bust it.
 * `cache()` additionally dedupes the two reads the root layout performs
 * (`generateViewport` + the layout body) into a single lookup per request.
 */
const readActiveThemeCached = unstable_cache(
  async (): Promise<ThemeId> => {
    const value = await getSetting(SETTING_KEYS.themeActive)
    return isThemeId(value) ? value : DEFAULT_THEME
  },
  ["active-theme"],
  { tags: [SETTINGS_CACHE_TAG], revalidate: 3600 },
)

export const getActiveThemeCached = cache(readActiveThemeCached)

export interface PaymentMethodConfig {
  method: "CARD" | "TON" | "USDT" | "STARS"
  enabled: boolean
  address: string | null // card number / wallet address (null for stars)
  holder?: string | null // card holder
  bank?: string | null
  network?: string | null // BEP20 / TRC20 / TON
}

export interface PaymentConfig {
  minToman: number
  methods: PaymentMethodConfig[]
}

/**
 * Active top-up methods + their destination details. A method is only
 * "available" when enabled AND it has the data it needs (card number / address).
 */
export async function getPaymentConfig(): Promise<PaymentConfig> {
  const s = await getAllSettings()
  const minToman = toNumber(s[SETTING_KEYS.payMinToman], 10000)
  const methods: PaymentMethodConfig[] = [
    {
      method: "CARD",
      enabled: toBool(s[SETTING_KEYS.payCardEnabled]) && !!s[SETTING_KEYS.payCardNumber],
      address: s[SETTING_KEYS.payCardNumber] || null,
      holder: s[SETTING_KEYS.payCardHolder] || null,
      bank: s[SETTING_KEYS.payCardBank] || null,
    },
    {
      method: "USDT",
      enabled: toBool(s[SETTING_KEYS.payUsdtEnabled]) && !!s[SETTING_KEYS.payUsdtAddress],
      address: s[SETTING_KEYS.payUsdtAddress] || null,
      network: s[SETTING_KEYS.payUsdtNetwork] || "BEP20",
    },
    {
      method: "TON",
      enabled: toBool(s[SETTING_KEYS.payTonEnabled]) && !!s[SETTING_KEYS.payTonAddress],
      address: s[SETTING_KEYS.payTonAddress] || null,
      network: "TON",
    },
    {
      method: "STARS",
      enabled: toBool(s[SETTING_KEYS.payStarsEnabled]),
      address: null,
    },
  ]
  return { minToman, methods }
}

export interface MaintenanceConfig {
  enabled: boolean
  title: string
  message: string
  supportUrl: string
}

/**
 * Current maintenance state, shared by the web app, Mini App and bot. When
 * `enabled` is true, regular users are blocked and shown this notice; admins
 * are always allowed through (the gate is applied by callers, not here).
 */
export async function getMaintenance(db: Db = prisma): Promise<MaintenanceConfig> {
  const [enabled, title, message, supportUrl] = await Promise.all([
    getSetting(SETTING_KEYS.maintenanceEnabled, db),
    getSetting(SETTING_KEYS.maintenanceTitle, db),
    getSetting(SETTING_KEYS.maintenanceMessage, db),
    getSetting(SETTING_KEYS.maintenanceSupportUrl, db),
  ])
  return {
    enabled: toBool(enabled),
    title: title || DEFAULTS[SETTING_KEYS.maintenanceTitle],
    message: message || DEFAULTS[SETTING_KEYS.maintenanceMessage],
    supportUrl: supportUrl.trim(),
  }
}
