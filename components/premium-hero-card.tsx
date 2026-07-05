"use client"

import type { ReactNode } from "react"

import { LivingSurface } from "@/components/living-surface"

/**
 * PremiumHeroCard — the canonical tier-reactive hero surface.
 *
 * Fuses the frozen cinematic utilities (`gold-border` animated gradient frame,
 * `sheen` light sweep, `surface-glow` corner light) with the tier-aware
 * `LivingSurface` ambient layer. Because every visual is token-driven, the card
 * fully reskins with the user's active membership tier (Bronze copper → Silver
 * platinum → Gold → Diamond crystal → VIP imperial) with zero per-tier code.
 *
 * Layout-neutral: it only provides the premium skin + ambient depth and a
 * z-lifted content slot. Compose any hero content inside (identity + balance,
 * rewards summary, wallet card, etc.). Reuse this instead of hand-rolling
 * `gold-border sheen surface-glow` + inline ambient blobs on individual pages.
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
  return (
    <section
      aria-label={ariaLabel}
      className={`gold-border sheen surface-glow relative overflow-hidden px-4 py-3.5 shadow-xl shadow-primary/10 sm:px-5 sm:py-4 ${className}`}
    >
      <LivingSurface intensity={intensity} lines={lines} particles={particles} blooms={blooms} />
      <div className="relative z-[2]">{children}</div>
    </section>
  )
}
