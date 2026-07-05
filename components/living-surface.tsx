"use client"

import { useMotionTier } from "@/components/motion-provider"

/**
 * LivingSurface — the tier-aware ambient animation layer.
 *
 * A single decorative backdrop that fuses ambient lighting (breathing glow
 * blooms), animated flowing lines, and drifting particles. Every effect is
 * painted with the membership accent tokens (`--tier-glow`, `--tier-line`,
 * `--tier-particle`, `--primary`), so it reskins automatically with the active
 * tier. Transform/opacity + SVG stroke only → GPU-accelerated.
 *
 * Purely decorative: `pointer-events-none`, `aria-hidden`, sits at z-0 behind
 * content. Density auto-tunes to the effective motion tier (cinematic → full,
 * balanced → lines + blooms, minimal → static wash) so low-end devices and
 * the Telegram webview stay at 60fps.
 *
 * Drop it as the first child of any `relative overflow-hidden` surface, then
 * lift real content to `relative z-[2]`.
 */

type Intensity = "soft" | "normal" | "bold"

const BLOOM_OPACITY: Record<Intensity, string> = {
  soft: "opacity-40",
  normal: "opacity-60",
  bold: "opacity-90",
}

// Deterministic particle field (no Math.random → SSR-stable, no hydration drift).
const PARTICLES = [
  { left: "12%", top: "22%", size: 4, delay: "0s" },
  { left: "28%", top: "68%", size: 3, delay: "0.7s" },
  { left: "46%", top: "16%", size: 5, delay: "1.4s" },
  { left: "63%", top: "74%", size: 3, delay: "0.4s" },
  { left: "78%", top: "34%", size: 4, delay: "1.1s" },
  { left: "88%", top: "60%", size: 3, delay: "1.9s" },
  { left: "38%", top: "44%", size: 2, delay: "2.3s" },
  { left: "70%", top: "12%", size: 2, delay: "0.9s" },
]

export function LivingSurface({
  className = "",
  intensity = "normal",
  lines = true,
  particles = true,
  blooms = true,
}: {
  className?: string
  intensity?: Intensity
  lines?: boolean
  particles?: boolean
  blooms?: boolean
}) {
  const tier = useMotionTier()
  const isMinimal = tier === "minimal"
  const isCinematic = tier === "cinematic"

  // Particle drift is the heaviest loop → cinematic-only; thin the field on
  // balanced. Lines + blooms are cheap and carry the brand cue everywhere.
  const showParticles = particles && !isMinimal
  const particleField = isCinematic ? PARTICLES : PARTICLES.slice(0, 4)

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
    >
      {/* Ambient breathing glow blooms (ambient lighting). */}
      {blooms && (
        <>
          <span
            className={`animate-bloom absolute -right-10 -top-12 h-36 w-36 rounded-full blur-3xl ${BLOOM_OPACITY[intensity]}`}
            style={{ backgroundColor: "var(--tier-glow)" }}
          />
          <span
            className={`animate-bloom absolute -bottom-16 -left-10 h-40 w-40 rounded-full blur-3xl ${BLOOM_OPACITY[intensity]}`}
            style={{ backgroundColor: "var(--tier-glow)", animationDelay: "1.6s", opacity: 0.5 }}
          />
        </>
      )}

      {/* Flowing energy lines (animated accent streams). */}
      {lines && (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M-20 150 C 80 90, 160 170, 240 110 S 400 60, 440 120"
            stroke="var(--tier-line)"
            strokeWidth="1.25"
            strokeLinecap="round"
            className="flow-line"
            opacity="0.5"
          />
          <path
            d="M-20 60 C 90 30, 170 90, 250 50 S 400 30, 440 70"
            stroke="var(--tier-line)"
            strokeWidth="1"
            strokeLinecap="round"
            className="flow-line-slow"
            opacity="0.3"
          />
        </svg>
      )}

      {/* Drifting / twinkling particles (cinematic depth). */}
      {showParticles &&
        particleField.map((p, i) => (
          <span
            key={i}
            className="animate-drift absolute rounded-full"
            style={{
              left: p.left,
              top: p.top,
              height: p.size,
              width: p.size,
              backgroundColor: "var(--tier-particle)",
              boxShadow: "0 0 6px 1px var(--tier-particle)",
              animationDelay: p.delay,
              opacity: 0.7,
            }}
          />
        ))}
    </div>
  )
}
