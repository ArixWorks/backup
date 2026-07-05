/**
 * Membership visual-identity mapping (client-safe, no server imports).
 *
 * The app's PRIMARY skin is driven by the user's CURRENT ACTIVE membership tier
 * (VIP grant wins — see `effectiveTier` in lib/tiers.ts). This module maps a
 * logical Tier to the `data-tier` attribute value consumed by the palette blocks
 * in app/globals.css, and exposes a tiny per-tier descriptor used by the theme
 * provider / admin preview. Colors themselves live in CSS (single source of
 * truth) so tokens stay the only styling contract.
 */

import { TIER_ORDER, type Tier } from "@/lib/tiers"

/** The `data-tier` attribute value for a tier (lowercase of the logical name). */
export type TierThemeKey = "standard" | "bronze" | "silver" | "gold" | "diamond" | "vip"

export function tierThemeKey(tier: Tier): TierThemeKey {
  return tier.toLowerCase() as TierThemeKey
}

/** All theme keys in ascending rank order (for admin previews / pickers). */
export const TIER_THEME_KEYS: TierThemeKey[] = TIER_ORDER.map(tierThemeKey)

/**
 * A short human vibe per tier for tooltips / admin preview labels. Purely
 * descriptive — never used for styling (CSS owns the palette).
 */
export const TIER_THEME_VIBE: Record<TierThemeKey, string> = {
  standard: "گرافیت خنثی",
  bronze: "برنز مسی گرم",
  silver: "پلاتین نقره‌ای",
  gold: "طلایی سینمایی",
  diamond: "کریستال آبی",
  vip: "طلای امپراطوری",
}
