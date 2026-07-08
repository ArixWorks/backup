"use client"

import { createContext, useContext, useEffect, useMemo } from "react"
import { useSession } from "@/hooks/use-session"
import { type Tier } from "@/lib/tiers"
import { tierThemeKey, type TierThemeKey } from "@/lib/tier-theme"

/**
 * Dynamic Membership Theme System.
 *
 * Publishes the user's CURRENT ACTIVE membership tier as `<html data-tier=...>`,
 * which the palette blocks in globals.css use to reskin the ENTIRE app (accents,
 * glow, particles, shadows, halos) while keeping the same layout + base
 * background/foreground. The active tier always wins: upgrades, VIP purchases,
 * temporary VIP grants, or an admin change flow through `useSession()` (SWR,
 * 15s refresh) → the skin morphs the moment the effective tier changes.
 *
 * The token morph itself is a GPU-friendly CSS transition on the registered
 * accent @property tokens (see globals.css), so tier changes reskin the app
 * smoothly. This is decoration-only and respects the motion tier.
 */

type MembershipThemeValue = {
  /** The effective tier currently skinning the app. */
  tier: Tier
  /** The `data-tier` attribute value applied to <html>. */
  themeKey: TierThemeKey
}

const MembershipThemeContext = createContext<MembershipThemeValue | null>(null)

export function MembershipThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession()

  // Default to gold (matches the SSR default in globals.css) until the session
  // resolves, then follow the live effective tier.
  const tier: Tier = user?.membership.tier ?? "GOLD"
  const themeKey = tierThemeKey(tier)

  // Apply the tier to <html> for theme token switching.
  useEffect(() => {
    document.documentElement.dataset.tier = themeKey
  }, [themeKey])

  const value = useMemo<MembershipThemeValue>(() => ({ tier, themeKey }), [tier, themeKey])

  return (
    <MembershipThemeContext.Provider value={value}>
      {children}
    </MembershipThemeContext.Provider>
  )
}

/** Read the active membership theme. Safe gold default outside a provider. */
export function useMembershipTheme(): MembershipThemeValue {
  return (
    useContext(MembershipThemeContext) ?? { tier: "GOLD", themeKey: "gold" }
  )
}
