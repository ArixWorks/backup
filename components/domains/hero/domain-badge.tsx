"use client"

import { motion } from "motion/react"
import type { BadgeProjection } from "./globe-scene"

export type BadgeAccent = "violet" | "cyan" | "indigo"

/** Accent order the pills cycle through as they orbit. */
export const BADGE_ACCENTS: BadgeAccent[] = ["violet", "cyan", "indigo", "violet", "cyan"]

// Backgrounds sit near-opaque on purpose: these pills pass in front of a lit
// particle sphere, and a translucent fill lets it bleed through as muddy noise.
const ACCENT_CLASS: Record<BadgeAccent, string> = {
  violet:
    "border-[color:oklch(0.72_0.19_305_/_0.7)] bg-[color:oklch(0.19_0.07_300_/_0.88)] text-[color:oklch(0.92_0.09_305)] shadow-[0_0_18px_-2px_oklch(0.7_0.2_305_/_0.55)]",
  cyan: "border-[color:oklch(0.78_0.13_195_/_0.7)] bg-[color:oklch(0.18_0.05_205_/_0.88)] text-[color:oklch(0.93_0.08_195)] shadow-[0_0_18px_-2px_oklch(0.75_0.14_195_/_0.5)]",
  indigo:
    "border-[color:oklch(0.7_0.16_270_/_0.7)] bg-[color:oklch(0.18_0.06_272_/_0.88)] text-[color:oklch(0.92_0.08_272)] shadow-[0_0_18px_-2px_oklch(0.68_0.18_270_/_0.5)]",
}

/**
 * The extension pill itself. Shared by the orbiting 3D badges and the static
 * reduced-motion fallback so both paths stay visually identical.
 */
export function TldPill({
  label,
  accent,
  onSelect,
  selectLabel,
}: {
  label: string
  accent: BadgeAccent
  onSelect: (tld: string) => void
  selectLabel: string
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(label)}
      aria-label={`${selectLabel} ${label}`}
      // Extensions are always Latin, so force LTR: under RTL the leading dot is
      // neutral and renders on the wrong side ("com." instead of ".com").
      dir="ltr"
      className={`pointer-events-auto rounded-xl border px-3 py-1.5 font-mono text-sm font-semibold backdrop-blur-sm transition-transform duration-200 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:oklch(0.8_0.14_300)] ${ACCENT_CLASS[accent]}`}
    >
      {label}
    </button>
  )
}

/**
 * A pill pinned to a fixed point in the globe's 3D space.
 *
 * Position, scale, stacking order and opacity all come from motion values the
 * WebGL frame loop writes directly, so the pill genuinely orbits with the
 * sphere and dims as it swings behind it - without re-rendering React.
 */
export function DomainBadge({
  label,
  accent,
  projection,
  onSelect,
  selectLabel,
}: {
  label: string
  accent: BadgeAccent
  projection: BadgeProjection
  onSelect: (tld: string) => void
  selectLabel: string
}) {
  return (
    <motion.div
      // Only the pill should take pointer events - the container behind it is
      // the drag surface, so this wrapper must stay transparent to them.
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{ x: projection.x, y: projection.y, zIndex: projection.depth }}
    >
      <motion.div
        // `!opacity-100` overrides the inline depth fade whenever focus lands
        // inside. Without it a keyboard user tabbing to a pill on the far side
        // gets a focus ring at ~6% opacity, which fails WCAG 2.4.7.
        className="-translate-x-1/2 -translate-y-1/2 focus-within:!opacity-100"
        style={{ scale: projection.scale, opacity: projection.opacity }}
      >
        <TldPill label={label} accent={accent} onSelect={onSelect} selectLabel={selectLabel} />
      </motion.div>
    </motion.div>
  )
}
