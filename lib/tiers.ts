/**
 * Single source of truth for the membership-tier system, shared by server
 * (engine, APIs, bot) and client (badges, cards). Keep this file free of
 * server-only imports so client components can import labels + visual styles.
 *
 * Two concepts:
 *  - EARNED tier: auto-assigned from lifetime points/spend (STANDARD..DIAMOND).
 *  - EFFECTIVE tier: what the whole app shows. Equals VIP when an admin has
 *    granted an active manual VIP membership, otherwise the earned tier.
 *
 * VIP sits above the ladder and is granted/revoked exclusively by an admin.
 */

/** Auto ladder, ascending. The engine only ever assigns one of these. */
export const EARNED_TIERS = ["STANDARD", "BRONZE", "SILVER", "GOLD", "DIAMOND"] as const
export type EarnedTier = (typeof EARNED_TIERS)[number]

/** Full logical ladder including the admin-only VIP at the very top. */
export const TIER_ORDER = ["STANDARD", "BRONZE", "SILVER", "GOLD", "DIAMOND", "VIP"] as const
export type Tier = (typeof TIER_ORDER)[number]

/** Earned tiers above STANDARD that carry configurable thresholds. */
export const THRESHOLD_TIERS = ["BRONZE", "SILVER", "GOLD", "DIAMOND"] as const
export type ThresholdTier = (typeof THRESHOLD_TIERS)[number]

/** Rank within the full ladder; higher = better. */
export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier)
}

/**
 * Normalize any stored/legacy VipTier value to a current earned tier.
 * Legacy PLATINUM and any stray stored VIP collapse to DIAMOND (top earned).
 */
export function normalizeEarnedTier(value: string | null | undefined): EarnedTier {
  switch (value) {
    case "BRONZE":
    case "SILVER":
    case "GOLD":
    case "DIAMOND":
      return value
    case "PLATINUM":
    case "VIP":
      return "DIAMOND"
    default:
      return "STANDARD"
  }
}

export type VipManualState = {
  vipManual?: boolean | null
  vipManualExpiresAt?: Date | string | null
}

/** Whether the user currently holds an active, non-expired manual VIP grant. */
export function isVipActive(user: VipManualState): boolean {
  if (!user?.vipManual) return false
  const exp = user.vipManualExpiresAt
  if (!exp) return true
  return new Date(exp).getTime() > Date.now()
}

/** The tier shown everywhere: VIP when active, else the earned tier. */
export function effectiveTier(
  user: VipManualState & { vipTier?: string | null },
): Tier {
  if (isVipActive(user)) return "VIP"
  return normalizeEarnedTier(user.vipTier)
}

// ---------------------------------------------------------------------------
// Visual identity + labels (theme-agnostic; tier colors are intrinsic to the
// rank, like medals, so they stay consistent across the gold/aurora themes).
// ---------------------------------------------------------------------------

export type TierVisual = {
  /** Persian label (default). Localized labels live in i18n messages. */
  label: string
  /** lucide-react icon name, mapped to a component where rendered. */
  glyph: "User" | "Medal" | "Award" | "Trophy" | "Gem" | "Crown"
  /** Chip/avatar background + foreground. */
  chip: string
  /** Ring color for cards. */
  ring: string
  /** Soft ambient glow blob color. */
  glow: string
  /** Border color for outlined surfaces. */
  border: string
  /** Solid accent text color. */
  text: string
  /** Progress/level bar fill. */
  bar: string
}

export const TIER_META: Record<Tier, TierVisual> = {
  STANDARD: {
    label: "استاندارد",
    glyph: "User",
    chip: "bg-muted text-muted-foreground",
    ring: "ring-border",
    glow: "bg-muted-foreground/10",
    border: "border-border",
    text: "text-muted-foreground",
    bar: "bg-muted-foreground/60",
  },
  BRONZE: {
    label: "برنزی",
    glyph: "Medal",
    chip: "bg-amber-700/20 text-amber-600 dark:text-amber-500",
    ring: "ring-amber-700/40",
    glow: "bg-amber-700/15",
    border: "border-amber-700/40",
    text: "text-amber-600 dark:text-amber-500",
    bar: "bg-amber-600",
  },
  SILVER: {
    label: "نقره‌ای",
    glyph: "Award",
    chip: "bg-slate-300/20 text-slate-500 dark:text-slate-300",
    ring: "ring-slate-300/45",
    glow: "bg-slate-300/15",
    border: "border-slate-300/45",
    text: "text-slate-500 dark:text-slate-300",
    bar: "bg-slate-400",
  },
  GOLD: {
    label: "طلایی",
    glyph: "Trophy",
    chip: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    ring: "ring-yellow-500/45",
    glow: "bg-yellow-500/15",
    border: "border-yellow-500/45",
    text: "text-yellow-600 dark:text-yellow-400",
    bar: "bg-yellow-500",
  },
  DIAMOND: {
    label: "دایموند",
    glyph: "Gem",
    chip: "bg-cyan-400/20 text-cyan-600 dark:text-cyan-300",
    ring: "ring-cyan-400/45",
    glow: "bg-cyan-400/15",
    border: "border-cyan-400/45",
    text: "text-cyan-600 dark:text-cyan-300",
    bar: "bg-cyan-400",
  },
  VIP: {
    label: "وی‌آی‌پی",
    glyph: "Crown",
    chip: "bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 text-violet-600 dark:text-violet-300",
    ring: "ring-violet-500/50",
    glow: "bg-violet-500/20",
    border: "border-violet-500/50",
    text: "text-violet-600 dark:text-violet-300",
    bar: "bg-gradient-to-r from-violet-500 to-fuchsia-500",
  },
}

/** i18n message key for a tier label, e.g. "tier.diamond". */
export function tierLabelKey(tier: Tier): string {
  return `tier.${tier.toLowerCase()}`
}

/**
 * Localized tier labels for non-React surfaces (the Telegram bot) that can't use
 * the client i18n provider. Mirrors the web i18n `tier.*` keys. Falls back to fa.
 */
export const TIER_LABELS_BY_LOCALE: Record<string, Record<Tier, string>> = {
  fa: { STANDARD: "استاندارد", BRONZE: "برنزی", SILVER: "نقره‌ای", GOLD: "طلایی", DIAMOND: "دایموند", VIP: "وی‌آی‌پی" },
  en: { STANDARD: "Standard", BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", DIAMOND: "Diamond", VIP: "VIP" },
  ru: { STANDARD: "Стандарт", BRONZE: "Бронза", SILVER: "Серебро", GOLD: "Золото", DIAMOND: "Бриллиант", VIP: "VIP" },
  hi: { STANDARD: "स्टैंडर्ड", BRONZE: "ब्रॉन्ज़", SILVER: "सिल्वर", GOLD: "गोल्ड", DIAMOND: "डायमंड", VIP: "VIP" },
}

/** A short emoji that visually matches each tier (used by the bot). */
export const TIER_EMOJI: Record<Tier, string> = {
  STANDARD: "▫️",
  BRONZE: "🥉",
  SILVER: "🥈",
  GOLD: "🥇",
  DIAMOND: "💎",
  VIP: "👑",
}

/** Localized tier label with safe fallback to Persian. */
export function tierLabelFor(tier: Tier, locale: string): string {
  return (TIER_LABELS_BY_LOCALE[locale] ?? TIER_LABELS_BY_LOCALE.fa)[tier]
}
