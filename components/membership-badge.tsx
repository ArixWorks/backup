"use client"

import { User, Medal, Award, Trophy, Gem, Crown, type LucideIcon } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { TIER_META, tierLabelKey, type Tier } from "@/lib/tiers"
import type { MessageKey } from "@/lib/i18n/messages"

/** Map the tier glyph name (from TIER_META) to a concrete lucide icon. */
const GLYPHS: Record<TierVisualGlyph, LucideIcon> = {
  User,
  Medal,
  Award,
  Trophy,
  Gem,
  Crown,
}
type TierVisualGlyph = (typeof TIER_META)[Tier]["glyph"]

/**
 * Compact, tier-colored membership chip used across the app (home hero, rewards,
 * profile, etc.) so the user's level looks identical everywhere. Colors and icon
 * come from the shared TIER_META source of truth.
 */
export function MembershipBadge({
  tier,
  size = "md",
  className = "",
}: {
  tier: Tier
  size?: "sm" | "md"
  className?: string
}) {
  const { t } = useI18n()
  const meta = TIER_META[tier]
  const Icon = GLYPHS[meta.glyph]
  const label = t(tierLabelKey(tier) as MessageKey)
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px] gap-1" : "px-2.5 py-1 text-[11px] gap-1.5"
  const icon = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ring-1 ${meta.chip} ${meta.ring} ${pad} ${className}`}
    >
      <Icon className={icon} strokeWidth={2.4} />
      {label}
    </span>
  )
}
