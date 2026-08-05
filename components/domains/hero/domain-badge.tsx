"use client"

import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react"

export type BadgeAccent = "violet" | "cyan" | "indigo"

export type BadgeSpec = {
  label: string
  accent: BadgeAccent
  /** Vertical anchor as a percentage of the stage height. */
  top: number
  /** Horizontal anchor as a percentage of the stage width. */
  left: number
  /** 0 = far away (subtle drift), 1 = closest to the viewer (strongest drift). */
  depth: number
}

const ACCENT_CLASS: Record<BadgeAccent, string> = {
  violet:
    "border-[color:oklch(0.72_0.19_305_/_0.55)] bg-[color:oklch(0.28_0.09_300_/_0.55)] text-[color:oklch(0.9_0.09_305)] shadow-[0_0_18px_-2px_oklch(0.7_0.2_305_/_0.55)]",
  cyan: "border-[color:oklch(0.78_0.13_195_/_0.55)] bg-[color:oklch(0.26_0.06_205_/_0.55)] text-[color:oklch(0.92_0.08_195)] shadow-[0_0_18px_-2px_oklch(0.75_0.14_195_/_0.5)]",
  indigo:
    "border-[color:oklch(0.7_0.16_270_/_0.55)] bg-[color:oklch(0.26_0.08_272_/_0.55)] text-[color:oklch(0.9_0.08_272)] shadow-[0_0_18px_-2px_oklch(0.68_0.18_270_/_0.5)]",
}

/**
 * A floating extension pill anchored around the globe. Each badge translates on
 * its own `depth` so the cluster reads as real parallax rather than a flat
 * overlay, and it stays a real button for keyboard and screen-reader users.
 */
export function DomainBadge({
  spec,
  pointerX,
  pointerY,
  onSelect,
  selectLabel,
}: {
  spec: BadgeSpec
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  onSelect: (tld: string) => void
  selectLabel: string
}) {
  const reduceMotion = useReducedMotion()
  const travel = 26 * spec.depth

  const x = useTransform(pointerX, [-1, 1], [-travel, travel])
  const y = useTransform(pointerY, [-1, 1], [-travel * 0.7, travel * 0.7])
  const rotate = useTransform(pointerX, [-1, 1], [-5 * spec.depth, 5 * spec.depth])

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        top: `${spec.top}%`,
        left: `${spec.left}%`,
        x: reduceMotion ? 0 : x,
        y: reduceMotion ? 0 : y,
        rotate: reduceMotion ? 0 : rotate,
        scale: 0.86 + spec.depth * 0.24,
        zIndex: Math.round(spec.depth * 10),
      }}
      animate={reduceMotion ? undefined : { translateY: [0, -6, 0] }}
      transition={
        reduceMotion
          ? undefined
          : {
              duration: 5 + spec.depth * 2.5,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }
      }
    >
      <button
        type="button"
        onClick={() => onSelect(spec.label)}
        aria-label={`${selectLabel} ${spec.label}`}
        className={`rounded-xl border px-3 py-1.5 font-mono text-sm font-semibold backdrop-blur-sm transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:oklch(0.8_0.14_300)] ${ACCENT_CLASS[spec.accent]}`}
      >
        {spec.label}
      </button>
    </motion.div>
  )
}
