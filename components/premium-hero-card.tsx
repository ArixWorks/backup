"use client"

import type { PointerEvent, ReactNode } from "react"

import {
  motion,
  useMotionValue,
  useReducedMotion,
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
  const reduce = useReducedMotion()
  const tier = useMotionTier()
  const interactive = !reduce && tier !== "minimal"

  // Pointer-driven tilt (degrees) + normalized glow position (%).
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)

  const srx = useSpring(rx, { stiffness: 150, damping: 16 })
  const sry = useSpring(ry, { stiffness: 150, damping: 16 })
  const sgx = useSpring(gx, { stiffness: 120, damping: 22 })
  const sgy = useSpring(gy, { stiffness: 120, damping: 22 })

  // Accent glow that trails the finger / cursor across the interior.
  const pointerGlow = useTransform(
    [sgx, sgy] as const,
    ([x, y]: number[]) =>
      `radial-gradient(240px circle at ${x}% ${y}%, color-mix(in oklch, var(--tier-glow) 28%, transparent), transparent 68%)`,
  )

  function trackPointer(e: PointerEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    // Corners lift toward / away from the viewer — the "floating panel" feel.
    ry.set(nx * 11)
    rx.set(-ny * 11)
    gx.set((nx + 0.5) * 100)
    gy.set((ny + 0.5) * 100)
  }

  function resetPointer() {
    rx.set(0)
    ry.set(0)
    gx.set(50)
    gy.set(50)
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
        style={{ rotateX: srx, rotateY: sry }}
        onPointerMove={trackPointer}
        onPointerLeave={resetPointer}
        onPointerCancel={resetPointer}
      >
        <LivingSurface intensity={intensity} lines={lines} particles={particles} blooms={blooms} />
        {/* Accent glow that drifts under the pointer / finger. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: pointerGlow }}
        />
        <div className="relative z-[2] [transform:translateZ(30px)]">{children}</div>
      </motion.section>
    </motion.div>
  )
}
