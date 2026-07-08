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
 * Fuses the frozen cinematic utilities (`gold-border` animated gradient frame,
 * `sheen` light sweep, `surface-glow` corner light) with the tier-aware
 * `LivingSurface` ambient layer. Because every visual is token-driven, the card
 * fully reskins with the user's active membership tier (Bronze copper → Silver
 * platinum → Gold → Diamond crystal → VIP imperial) with zero per-tier code.
 *
 * It also *levitates*: a gentle idle float plus a pointer/touch-tracked 3D tilt
 * make the card feel suspended in space, and a soft accent glow drifts under the
 * finger/cursor so the interior surface reads as living light. All motion is
 * decoration-only, GPU-accelerated (transform/opacity), and auto-disabled under
 * reduced-motion or the `minimal` motion tier so the Telegram webview stays flat
 * and snappy.
 *
 * Layout-neutral: it only provides the premium skin + ambient depth and a
 * z-lifted content slot. Compose any hero content inside (identity + balance,
 * rewards summary, wallet card, etc.).
 */
export function PremiumHeroCard({
  children,
  className = "",
  intensity = "normal",
  lines = true,
  particles = true,
  blooms = true,
  "aria-label": ariaLabel,
}: {
  children: ReactNode
  className?: string
  intensity?: "soft" | "normal" | "bold"
  lines?: boolean
  particles?: boolean
  blooms?: boolean
  "aria-label"?: string
}) {
  const tier = useMotionTier()
  // Follow the *resolved* motion tier (which already folds in OS Reduce-Motion
  // for Auto users and an explicit opt-in otherwise) — never gate on the raw OS
  // media query here, or an explicit "Cinematic" choice would be ignored.
  const interactive = tier !== "minimal"

  // Pointer-driven tilt (degrees) + normalized glow position (%).
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)
  // Lift/scale: the card pops toward the viewer while engaged.
  const lift = useMotionValue(0)

  const srx = useSpring(rx, { stiffness: 170, damping: 15 })
  const sry = useSpring(ry, { stiffness: 170, damping: 15 })
  const sgx = useSpring(gx, { stiffness: 120, damping: 22 })
  const sgy = useSpring(gy, { stiffness: 120, damping: 22 })
  const sLift = useSpring(lift, { stiffness: 220, damping: 20 })

  // Engaged scale (1 → 1.025) derived from the lift signal.
  const scale = useTransform(sLift, [0, 1], [1, 1.025])

  // Primary aurora halo that trails the finger / cursor across the interior —
  // large and clearly visible so the surface reads as living, moving light.
  const pointerGlow = useTransform(
    [sgx, sgy] as const,
    ([x, y]: number[]) =>
      `radial-gradient(320px circle at ${x}% ${y}%, color-mix(in oklch, var(--tier-glow) 55%, transparent), transparent 70%)`,
  )

  // A second, counter-drifting halo (mirrored across the card) adds depth so it
  // feels like layered aurora rather than a single spotlight.
  const pointerGlowB = useTransform(
    [sgx, sgy] as const,
    ([x, y]: number[]) =>
      `radial-gradient(260px circle at ${100 - x}% ${100 - y}%, color-mix(in oklch, var(--primary) 30%, transparent), transparent 72%)`,
  )

  // Parallax offset for the ambient bloom layer so the halos physically shift
  // toward the pointer (not just recolor). Range kept small to avoid edge gaps.
  const auroraX = useTransform(sgx, [0, 100], [-22, 22])
  const auroraY = useTransform(sgy, [0, 100], [-18, 18])

  // Glossy specular highlight (a bright, tight glare) that skates across the
  // glass following the pointer — the signature "premium 3D card" sheen.
  const specular = useTransform(
    [sgx, sgy] as const,
    ([x, y]: number[]) =>
      `radial-gradient(420px circle at ${x}% ${y}%, color-mix(in oklch, white 30%, transparent), transparent 55%)`,
  )

  // Dynamic grounding shadow: it shifts opposite the tilt so the floating panel
  // feels physically lit from above and anchored in space.
  const dropShadow = useTransform([srx, sry, sLift] as const, ([x, y, l]: number[]) => {
    const ox = y * -1.6
    const oy = x * 1.6 + 16 + l * 8
    const blur = 34 + l * 16
    return `${ox}px ${oy}px ${blur}px -14px color-mix(in oklch, var(--tier-glow) 55%, transparent)`
  })

  function trackPointer(e: PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    // Corners lift toward / away from the viewer — the "floating panel" feel.
    ry.set(nx * 15)
    rx.set(-ny * 15)
    gx.set((nx + 0.5) * 100)
    gy.set((ny + 0.5) * 100)
  }

  function engage() {
    lift.set(1)
  }

  function resetPointer() {
    rx.set(0)
    ry.set(0)
    gx.set(50)
    gy.set(50)
    lift.set(0)
  }

  const cardClass =
    `gold-border sheen surface-glow relative overflow-hidden px-4 py-3.5 shadow-xl shadow-primary/10 sm:px-5 sm:py-4 ${className}`.trim()

  // Static path: identical layout, zero interaction cost.
  if (!interactive) {
    return (
      <section aria-label={ariaLabel} className={cardClass}>
        <LivingSurface intensity={intensity} lines={lines} particles={particles} blooms={blooms} />
        <div className="relative z-[2]">{children}</div>
      </section>
    )
  }

  return (
    <motion.div
      className="[perspective:1100px]"
      animate={{ y: [0, -7, 0] }}
      transition={{ duration: 6.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
    >
      <motion.section
        aria-label={ariaLabel}
        className={`${cardClass} [transform-style:preserve-3d] will-change-transform`}
        style={{ rotateX: srx, rotateY: sry, scale, boxShadow: dropShadow }}
        onPointerEnter={engage}
        onPointerDown={engage}
        onPointerMove={trackPointer}
        onPointerLeave={resetPointer}
        onPointerUp={resetPointer}
        onPointerCancel={resetPointer}
      >
        {/* Ambient bloom/particle layer, parallax-shifted toward the pointer so
            the halos physically drift with the cursor / touch. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{ x: auroraX, y: auroraY }}
        >
          <LivingSurface intensity={intensity} lines={lines} particles={particles} blooms={blooms} />
        </motion.div>
        {/* Layered aurora halos that trail the pointer / finger. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: pointerGlow }}
        />
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: pointerGlowB }}
        />
        {/* Glossy specular glare skating across the glass. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] mix-blend-screen [transform:translateZ(60px)]"
          style={{ background: specular }}
        />
        <div className="relative z-[2] [transform:translateZ(38px)]">{children}</div>
      </motion.section>
    </motion.div>
  )
}
