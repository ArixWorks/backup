"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSession } from "@/hooks/use-session"
import { useMotionTier } from "@/components/motion-provider"
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
 * accent @property tokens (see globals.css). On top of that we fire a one-shot
 * cinematic "bloom" flash in the new accent color so tier changes feel like an
 * event, not a repaint. Both are decoration-only and respect the motion tier.
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
  const motionTier = useMotionTier()

  // Default to gold (matches the SSR default in globals.css) until the session
  // resolves, then follow the live effective tier.
  const tier: Tier = user?.membership.tier ?? "GOLD"
  const themeKey = tierThemeKey(tier)

  const [mounted, setMounted] = useState(false)
  const [flashKey, setFlashKey] = useState<number | null>(null)
  const prevKey = useRef<TierThemeKey | null>(null)

  useEffect(() => setMounted(true), [])

  // Apply the tier to <html> and trigger the cinematic bloom when it changes.
  useEffect(() => {
    document.documentElement.dataset.tier = themeKey
    if (prevKey.current !== null && prevKey.current !== themeKey && motionTier !== "minimal") {
      setFlashKey(Date.now())
    }
    prevKey.current = themeKey
  }, [themeKey, motionTier])

  const value = useMemo<MembershipThemeValue>(() => ({ tier, themeKey }), [tier, themeKey])

  return (
    <MembershipThemeContext.Provider value={value}>
      {children}
      {mounted && flashKey !== null
        ? createPortal(
            <div
              key={flashKey}
              aria-hidden
              onAnimationEnd={() => setFlashKey(null)}
              className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
            >
              <span
                className="tier-bloom-flash h-[60vmin] w-[60vmin] rounded-full blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, var(--tier-glow) 0%, transparent 68%)",
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </MembershipThemeContext.Provider>
  )
}

/** Read the active membership theme. Safe gold default outside a provider. */
export function useMembershipTheme(): MembershipThemeValue {
  return (
    useContext(MembershipThemeContext) ?? { tier: "GOLD", themeKey: "gold" }
  )
}
