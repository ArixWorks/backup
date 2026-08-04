"use client"

import { memo } from "react"
import { motion, useSpring, useTransform, type MotionValue } from "motion/react"

/**
 * One floating extension badge orbiting the globe.
 *
 * Parallax is driven entirely by motion values handed down from the stage, so
 * pointer movement animates on the compositor without a single React render.
 * `depth` gives every badge its own apparent distance: nearer badges travel
 * further, which is what sells the 3D feel.
 */

export type BadgeAccent = "violet" | "cyan" | "indigo"

export interface BadgeSpec {
  label: string
  accent: BadgeAccent
  /** Anchor inside the square stage, in percent. */
  top: number
  left: number
  /** 0.4 (far) .. 1 (near) - scales parallax travel. */
  depth: number
}

const ACCENT: Record<BadgeAccent, string> = {
  violet: "border-primary/60 bg-primary/10 text-primary shadow-[0_0_18px_-4px_var(--color-primary)]",
  cyan: "border-chart-2/60 bg-chart-2/10 text-chart-2 shadow-[0_0_18px_-4px_var(--color-chart-2)]",
  indigo: "border-chart-3/60 bg-chart-3/10 text-chart-3 shadow-[0_0_18px_-4px_var(--color-chart-3)]",
}

const SPRING = { stiffness: 110, damping: 20, mass: 0.4 } as const

export const DomainBadge = memo(function DomainBadge({
  spec,
  pointerX,
  pointerY,
  interactive,
  onSelect,
  selectLabel,
}: {
  spec: BadgeSpec
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  interactive: boolean
  onSelect: (tld: string) => void
  selectLabel: string
}) {
  // Travel budget is deliberately small (max ~20px) so badges drift without
  // ever colliding with each other or the globe.
  const x = useSpring(useTransform(pointerX, (value) => value * spec.depth * 20), SPRING)
  const y = useSpring(useTransform(pointerY, (value) => value * spec.depth * 15), SPRING)
  const rotate = useSpring(useTransform(pointerX, (value) => value * spec.depth * 4), SPRING)
  const scale = useSpring(useTransform(pointerY, (value) => 1 + Math.abs(value) * spec.depth * 0.03), SPRING)

  return (
    <motion.div
      className="absolute z-[4] -translate-x-1/2 -translate-y-1/2"
      style={{ top: `${spec.top}%`, left: `${spec.left}%`, x, y, rotate, scale }}
    >
      <motion.button
        type="button"
        onClick={() => onSelect(spec.label)}
        aria-label={`${selectLabel} ${spec.label}`}
        className={`flex cursor-pointer items-center rounded-xl border px-3 py-1.5 font-mono text-sm font-bold backdrop-blur-md transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:text-base ${ACCENT[spec.accent]}`}
        animate={interactive ? { y: [0, -6, 0] } : undefined}
        transition={{ duration: 4.2 + spec.depth * 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        whileHover={{ scale: 1.08, y: -6 }}
        whileTap={{ scale: 0.96 }}
      >
        <span dir="ltr">{spec.label}</span>
      </motion.button>
    </motion.div>
  )
})
