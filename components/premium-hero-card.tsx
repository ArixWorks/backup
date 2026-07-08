"use client"

import type { PointerEvent, ReactNode } from "react"

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react"

import { LivingSurface } from "@/components/living-surface"
import { useMotionTier } from "@/components/motion-provider"

/**
 * PremiumHeroCard — the canonical tier-reactive hero surface.
 *
 * A calm, premium glass panel: a token-driven `gold-border` frame, a slow
 * `sheen` sweep, and a soft `surface-glow`, layered over a refined ambient
 * backdrop. Because every visual is token-driven, the card fully reskins with
 * the user's active membership tier (Bronze → Silver → Gold → Diamond → VIP)
 * with zero per-tier code.
 *
 * Motion philosophy — "quiet luxury, edge-lit":
 *   • The whole panel drifts *gently* toward the pointer (a few px) and tilts
 *     softly (≤6°) on buttery springs — a subtle levitation, never a jump.
 *   • Light lives on the EDGES: an accent rim brightens along the border
 *     nearest the cursor / finger (masked to the perimeter), instead of a harsh
 *     spotlight blob resting in the middle of the card.
 *   • At idle it settles perfectly flat and centered — no central halo.
 *
 * All motion is decoration-only, GPU-accelerated (transform/opacity), and
 * auto-disabled under reduced-motion or the `minimal` tier so the Telegram
 * webview stays flat and snappy.
 *
 * Layout-neutral: it only provides the premium skin + ambient depth and a
 * z-lifted content slot. Compose any hero content inside.
 */
export function PremiumHeroCard({
  children,
  className = "",
  intensity = "soft",
  "aria-label": ariaLabel,
}: {
  children: ReactNode
  className?: string
  intensity?: "soft" | "normal" | "bold"
  "aria-label"?: string
}) {
  const tier = useMotionTier()
  // Follow the *resolved* motion tier (which already folds in OS Reduce-Motion
  // for Auto users and an explicit opt-in otherwise) — never gate on the raw OS
  // media query here, or an explicit "Cinematic" choice would be ignored.
  const interactive = tier !== "minimal"

  // Pointer-driven tilt (deg), whole-card drift (px), and normalized edge-light
  // position (%). All default to a perfectly neutral resting state.
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const tx = useMotionValue(0)
  const ty = useMotionValue(0)
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)
  // Engagement signal (0 → 1): fades the edge light in only while hovered.
  const engaged = useMotionValue(0)

  // Soft, well-damped springs → smooth "settling" motion, never jittery.
  const spring = { stiffness: 90, damping: 20, mass: 0.7 }
  const glideSpring = { stiffness: 110, damping: 24, mass: 0.7 }
  const lightSpring = { stiffness: 70, damping: 26, mass: 0.8 }

  const srx = useSpring(rx, spring)
  const sry = useSpring(ry, spring)
  const stx = useSpring(tx, glideSpring)
  const sty = useSpring(ty, glideSpring)
  const sgx = useSpring(gx, lightSpring)
  const sgy = useSpring(gy, lightSpring)
  const sEngaged = useSpring(engaged, { stiffness: 120, damping: 24 })

  // Gentle pop toward the viewer while engaged (1 → 1.012, barely-there).
  const scale = useTransform(sEngaged, [0, 1], [1, 1.012])

  // Edge-lit accent: a broad accent glow that follows the pointer, but MASKED to
  // the perimeter so only the border nearest the cursor lights up. This is the
  // "motion from the edges" the surface is known for — no central hotspot.
  const edgeGlow = useTransform(
    [sgx, sgy] as const,
    ([x, y]: number[]) =>
      `radial-gradient(60% 120% at ${x}% ${y}%, color-mix(in oklch, var(--tier-glow) 42%, transparent), transparent 60%)`,
  )
  const edgeOpacity = useTransform(sEngaged, [0, 1], [0, 1])

  // A faint specular sheen on the glass, also masked to the edges so it grazes
  // the rim rather than washing out the center.
  const rimSheen = useTransform(
    [sgx, sgy] as const,
    ([x, y]: number[]) =>
      `radial-gradient(40% 90% at ${x}% ${y}%, color-mix(in oklch, white 22%, transparent), transparent 55%)`,
  )

  // Dynamic grounding shadow: shifts opposite the tilt so the floating panel
  // feels lit from above and anchored in space. Kept soft.
  const dropShadow = useTransform([srx, sry, sEngaged] as const, ([x, y, l]: number[]) => {
    const ox = y * -1.2
    const oy = x * 1.2 + 14 + l * 6
    const blur = 30 + l * 12
    return `${ox}px ${oy}px ${blur}px -16px color-mix(in oklch, var(--tier-glow) 42%, transparent)`
  })

  function trackPointer(e: PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    // Gentle: shallow tilt + a few px of whole-card glide toward the pointer.
    ry.set(nx * 6)
    rx.set(-ny * 6)
    tx.set(nx * 7)
    ty.set(ny * 5)
    gx.set((nx + 0.5) * 100)
    gy.set((ny + 0.5) * 100)
  }

  function engage() {
    engaged.set(1)
  }

  function resetPointer() {
    rx.set(0)
    ry.set(0)
    tx.set(0)
    ty.set(0)
    gx.set(50)
    gy.set(50)
    engaged.set(0)
  }

  const cardClass =
    `gold-border sheen surface-glow relative overflow-hidden px-4 py-3.5 shadow-xl shadow-primary/10 sm:px-5 sm:py-4 ${className}`.trim()

  // Perimeter mask: transparent through the middle, opaque toward the rim, so
  // the reactive light only ever renders on the edges of the card.
  const edgeMask =
    "radial-gradient(78% 78% at 50% 50%, transparent 56%, #000 92%)"

  // Static path: identical layout, zero interaction cost.
  if (!interactive) {
    return (
      <section aria-label={ariaLabel} className={cardClass}>
        <LivingSurface intensity={intensity} lines={false} particles={false} blooms />
        <div className="relative z-[2]">{children}</div>
      </section>
    )
  }

  return (
    <motion.div
      className="[perspective:1200px]"
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
    >
      <motion.section
        aria-label={ariaLabel}
        className={`${cardClass} [transform-style:preserve-3d] will-change-transform`}
        style={{ rotateX: srx, rotateY: sry, x: stx, y: sty, scale, boxShadow: dropShadow }}
        onPointerEnter={engage}
        onPointerDown={engage}
        onPointerMove={trackPointer}
        onPointerLeave={resetPointer}
        onPointerUp={resetPointer}
        onPointerCancel={resetPointer}
      >
        {/* Ambient backdrop: soft breathing edge blooms only — clean, no
            particles or streaks, and no central hotspot. */}
        <LivingSurface intensity={intensity} lines={false} particles={false} blooms />

        {/* Edge-lit accent glow that follows the pointer along the border. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background: edgeGlow,
            opacity: edgeOpacity,
            WebkitMaskImage: edgeMask,
            maskImage: edgeMask,
          }}
        />
        {/* Faint specular rim sheen, also masked to the edges. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] mix-blend-screen"
          style={{
            background: rimSheen,
            opacity: edgeOpacity,
            WebkitMaskImage: edgeMask,
            maskImage: edgeMask,
          }}
        />

        <div className="relative z-[2] [transform:translateZ(28px)]">{children}</div>
      </motion.section>
    </motion.div>
  )
}
