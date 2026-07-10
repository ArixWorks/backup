"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

/**
 * Adaptive cinematic motion system.
 *
 * Subio targets a stable 60fps inside the Telegram Mini App webview across a
 * huge range of devices. Rather than shipping one fixed amount of motion, we
 * resolve an *effective tier* and publish it as `<html data-motion="...">`,
 * which the CSS in globals.css uses to gate decorative animation, and which the
 * motion.tsx primitives read to decide whether to run pointer/scroll effects.
 *
 *   tier "cinematic" → full ambient depth, parallax, 3D tilt, particle loops
 *   tier "balanced"  → signature brand cues only (sheen/shimmer/glow), no heavy
 *                       continuous loops or pointer-tracked 3D
 *   tier "minimal"   → decorative motion silenced, snappy interaction timings
 *
 * The effective tier is derived from, in precedence order:
 *   1. OS "Reduce Motion" → always minimal (accessibility, non-negotiable)
 *   2. user preference (Auto / Minimal / Balanced / Cinematic) from settings
 *   3. when Auto: device-capability heuristic + a live FPS guard that can only
 *      step the tier DOWN if frames are being dropped (never up).
 *
 * This is presentation-only: it never changes layout, data, or interactions.
 */

export type MotionTier = "minimal" | "balanced" | "cinematic"
export type MotionPref = "auto" | MotionTier

export const MOTION_PREFS: MotionPref[] = ["auto", "cinematic", "balanced", "minimal"]

const STORAGE_KEY = "subio_motion"

type MotionContextValue = {
  /** The user's chosen preference (what they picked in settings). */
  pref: MotionPref
  /** Persist a new preference. */
  setPref: (pref: MotionPref) => void
  /** The effective tier currently applied to the document. */
  tier: MotionTier
  /** True while the OS requests reduced motion (pref is then forced to minimal). */
  reducedMotion: boolean
}

const MotionContext = createContext<MotionContextValue | null>(null)

const TIER_RANK: Record<MotionTier, number> = { minimal: 0, balanced: 1, cinematic: 2 }

function isMotionPref(value: unknown): value is MotionPref {
  return typeof value === "string" && (MOTION_PREFS as string[]).includes(value)
}

/** Capability heuristic → the richest tier this device should attempt at rest. */
function detectCapabilityTier(): MotionTier {
  if (typeof navigator === "undefined") return "cinematic"
  const cores = navigator.hardwareConcurrency ?? 8
  // deviceMemory is non-standard / Chromium-only; treat missing as generous.
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const platform = (
    typeof window !== "undefined" ? window.Telegram?.WebApp?.platform : undefined
  )?.toLowerCase()

  // Desktop Telegram / web clients are virtually always capable.
  if (platform === "tdesktop" || platform === "macos" || platform === "web") return "cinematic"

  // Only genuinely weak hardware drops to minimal. Mid-range phones (which very
  // commonly report 4 logical cores) keep the signature brand motion at
  // `balanced`; the live FPS guard can still step this down if it hitches.
  if (cores <= 2 || mem <= 1) return "minimal"
  if (cores <= 4 || mem <= 3) return "balanced"
  return "cinematic"
}

/**
 * Sample real frame rate for a short window and report the lowest sustained
 * tier the device can hold. Returns a tier ceiling we should not exceed.
 */
function sampleFrameRate(durationMs = 1800): Promise<MotionTier> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "undefined") return resolve("cinematic")
    let frames = 0
    const start = performance.now()
    let last = start
    let worstGap = 0
    const tick = (now: number) => {
      frames++
      worstGap = Math.max(worstGap, now - last)
      last = now
      if (now - start < durationMs) {
        requestAnimationFrame(tick)
      } else {
        const fps = (frames / (now - start)) * 1000
        // Use average fps as the primary signal; a single hitch shouldn't demote.
        if (fps < 32) resolve("minimal")
        else if (fps < 48) resolve("balanced")
        else resolve("cinematic")
      }
    }
    requestAnimationFrame(tick)
  })
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  // Out of the box every new user gets the full CINEMATIC experience. This is
  // only a *default* though — it is not the same as a deliberate "Cinematic"
  // pick in settings: the default still yields to OS Reduce-Motion and to the
  // live FPS guard on genuinely weak hardware. `chosen` tracks whether the user
  // has explicitly selected a mode (an explicit pick always wins outright).
  const [pref, setPrefState] = useState<MotionPref>("cinematic")
  const [chosen, setChosen] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  // Tier ceiling discovered by the live FPS guard.
  const [perfCeiling, setPerfCeiling] = useState<MotionTier>("cinematic")
  const guardRan = useRef(false)

  // Load stored preference once on mount (instant, no flash beyond default).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (isMotionPref(stored)) {
        setPrefState(stored)
        setChosen(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  // Track the OS reduce-motion preference live.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(mq.matches)
    update()
    mq.addEventListener?.("change", update)
    return () => mq.removeEventListener?.("change", update)
  }, [])

  // The effective tier depends on the live FPS ceiling whenever the user has
  // NOT made an explicit non-auto pick — i.e. explicit "Auto", or the untouched
  // cinematic default. An explicit Cinematic/Balanced/Minimal pick is honored
  // verbatim and needs no sampling.
  const usesPerfCeiling = pref === "auto" || !chosen

  // Run the FPS guard once after first paint when motion is allowed.
  useEffect(() => {
    if (guardRan.current || reducedMotion || !usesPerfCeiling) return
    guardRan.current = true
    // Only the explicit "Auto" mode pre-demotes by the hardware heuristic. The
    // cinematic default starts at the top and is stepped down solely by real
    // measured jank, so most phones keep the full experience out of the box.
    const cap = pref === "auto" ? detectCapabilityTier() : "cinematic"
    // Don't bother sampling on devices we already know are constrained.
    if (cap === "minimal") {
      setPerfCeiling("minimal")
      return
    }
    let cancelled = false
    // Defer until the app has settled so the sample reflects steady state.
    const id = window.setTimeout(() => {
      sampleFrameRate().then((measured) => {
        if (cancelled) return
        // Effective ceiling = the lower of capability guess and measured fps.
        const ceiling =
          TIER_RANK[measured] < TIER_RANK[cap] ? measured : cap
        setPerfCeiling(ceiling)
      })
    }, 1200)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [pref, reducedMotion, usesPerfCeiling])

  // Resolve the effective tier.
  //
  // Precedence:
  //   1. An *explicit* non-auto pick always wins — if someone deliberately
  //      turns effects up to Cinematic (or down) in settings, we honor it even
  //      when the OS has "Reduce Motion" on (a conscious opt-in overrides the
  //      global default).
  //   2. Otherwise (explicit "Auto", or the untouched cinematic default) we
  //      defer to OS Reduce-Motion, then to the live device/FPS ceiling. The
  //      default's ceiling starts at cinematic, so new users get the full
  //      experience unless their device actually drops frames.
  const tier: MotionTier = useMemo(() => {
    if (chosen && pref !== "auto") return pref
    if (reducedMotion) return "minimal"
    return perfCeiling
  }, [chosen, pref, reducedMotion, perfCeiling])

  // Publish to the document so CSS + Telegram chrome can react.
  useEffect(() => {
    document.documentElement.dataset.motion = tier
  }, [tier])

  const setPref = useCallback((next: MotionPref) => {
    setPrefState(next)
    setChosen(true)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    // Re-arm the guard so switching back to Auto re-measures.
    if (next === "auto") guardRan.current = false
  }, [])

  const value = useMemo<MotionContextValue>(
    () => ({ pref, setPref, tier, reducedMotion }),
    [pref, setPref, tier, reducedMotion],
  )

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
}

/**
 * Read the motion context. Returns a safe cinematic default when used outside a
 * provider so isolated components / tests never crash.
 */
export function useMotion(): MotionContextValue {
  return (
    useContext(MotionContext) ?? {
      pref: "auto",
      setPref: () => {},
      tier: "cinematic",
      reducedMotion: false,
    }
  )
}

/** Convenience: just the effective tier. */
export function useMotionTier(): MotionTier {
  return useMotion().tier
}
