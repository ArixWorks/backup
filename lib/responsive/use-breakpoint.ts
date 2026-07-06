"use client"

import { useSyncExternalStore } from "react"

/**
 * SSR-safe breakpoint + media-query hooks.
 *
 * Structural chrome is CSS-driven (Tailwind breakpoints + `tg:`/`web:`
 * variants) so it needs no JS and causes no CLS. These hooks exist for
 * BEHAVIORAL decisions that genuinely need the current viewport in JS —
 * ResponsiveDialog (Dialog vs Drawer), DataTable (table vs cards), motion, etc.
 *
 * They match Tailwind's default breakpoint scale, which we also treat as the
 * canonical responsive tiers audited across 320 → 2560.
 */

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
  // Extended tiers used by the ultrawide shell (right rail / wider gutters).
  "3xl": 1920,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

/** Subscribe to an arbitrary media query, SSR-safe (server = `false`). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}

/** True at or above the given breakpoint (min-width). */
export function useMinWidth(bp: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[bp]}px)`)
}

/** True when a fine pointer with real hover is present (desktop mouse). */
export function useHoverable(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)")
}

/** True when the user asked the OS to reduce motion. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}
