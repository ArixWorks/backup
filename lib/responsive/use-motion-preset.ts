"use client"

import { useHoverable, usePrefersReducedMotion } from "./use-breakpoint"

/**
 * Device-aware motion policy.
 *
 * Heavy hover/parallax/tilt effects are great with a mouse but waste CPU/GPU on
 * phones (jank, battery). This hook centralizes the decision so components can
 * scale their motion to the device instead of hard-coding it:
 *
 *  - `reduced`:  user asked the OS to minimize motion → disable non-essential
 *                animation entirely.
 *  - `rich`:     fine pointer + hover (desktop) and motion allowed → safe to run
 *                tilt/glare/parallax and hover transforms.
 *  - `enableHover` / `enableParallax`: convenience booleans for guarding effects.
 *
 * Note: purely presentational hover states handled in CSS should use the
 * `hoverable:` Tailwind variant; use this hook for JS-driven motion (Framer
 * Motion / Tilt / parallax listeners).
 */
export function useMotionPreset() {
  const hoverable = useHoverable()
  const reduced = usePrefersReducedMotion()
  const rich = hoverable && !reduced
  return {
    reduced,
    hoverable,
    rich,
    enableHover: rich,
    enableParallax: rich,
    /** Multiplier to soften transition distances/durations on touch. */
    intensity: rich ? 1 : reduced ? 0 : 0.5,
  }
}
