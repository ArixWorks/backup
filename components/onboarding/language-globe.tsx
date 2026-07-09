"use client"

import Image from "next/image"
import { motion } from "motion/react"

/**
 * Cinematic "global platform" hero for the language picker.
 *
 * A golden globe continuously spins on its axis (a seamless world-map texture
 * scrolls west-to-east behind spherical shading) inside two counter-rotating, tilted
 * orbital rings while gold particles twinkle, a soft double-bloom pulses behind
 * it, and two language glyph bubbles ("A" / "文") float at its sides. The whole
 * piece fills its flex parent (aspect-square, capped by max-h) so it scales down
 * on short Telegram viewports without ever forcing the screen to scroll.
 *
 * Everything is pure CSS transform / opacity, so it stays at 60fps in the
 * Telegram webview, and every loop is disabled under prefers-reduced-motion
 * (see the .animate-* rules in globals.css).
 */
export function LanguageGlobe() {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 18 }}
      className="relative mx-auto aspect-square h-full max-h-full w-auto max-w-full [perspective:1000px]"
      style={{ height: "min(100%, 15rem)" }}
      aria-hidden
    >
      {/* Soft double bloom behind the globe */}
      <div className="animate-glow absolute inset-[6%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_55%,transparent)_0%,transparent_62%)] blur-2xl" />
      <div className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_38%,transparent)_0%,transparent_70%)] blur-md" />

      {/* Twinkling gold dust */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="animate-twinkle absolute rounded-full bg-primary"
          style={{
            top: p.top,
            left: p.left,
            height: p.size,
            width: p.size,
            animationDelay: `${p.delay}s`,
            boxShadow: "0 0 6px 1px color-mix(in oklch, var(--primary) 70%, transparent)",
          }}
        />
      ))}

      {/* Outer tilted orbital ring (Saturn-style sweep) */}
      <div className="absolute inset-0 [transform:rotateX(72deg)] [transform-style:preserve-3d]">
        <div className="animate-orbit absolute inset-[10%] rounded-full">
          <div className="absolute inset-0 rounded-full border border-primary/30" />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: "2px solid transparent",
              background:
                "linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 92%, transparent), transparent) border-box",
              WebkitMask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
          {/* Comet highlight travelling the ring */}
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_12px_3px_color-mix(in_oklch,var(--primary)_80%,transparent)]" />
        </div>
      </div>

      {/* Inner counter-rotating ring, tilted the other way for depth */}
      <div className="absolute inset-0 [transform:rotateX(64deg)_rotateZ(28deg)] [transform-style:preserve-3d]">
        <div className="animate-orbit-rev absolute inset-[20%] rounded-full">
          <div className="absolute inset-0 rounded-full border border-primary/20" />
          <span className="absolute top-1/2 -right-1 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary/90 shadow-[0_0_10px_2px_color-mix(in_oklch,var(--primary)_70%,transparent)]" />
        </div>
      </div>

      {/* The globe — a real axial spin via a seamless scrolling world map,
          shaded into a sphere with a highlight, limb darkening and a gold rim. */}
      <div className="absolute inset-[14%] drop-shadow-[0_10px_36px_color-mix(in_oklch,var(--primary)_40%,transparent)]">
        <div className="relative h-full w-full overflow-hidden rounded-full bg-background">
          {/* Rotating surface: two identical map tiles sliding as one track */}
          <div className="animate-globe flex h-full w-[200%]">
            <div className="relative h-full w-1/2 shrink-0">
              <Image
                src="/onboarding/globe-gold-map.png"
                alt=""
                fill
                sizes="240px"
                className="object-cover"
                priority
              />
            </div>
            {/* Identical twin. The map's left & right edges are open black
                ocean, so the join and the loop wrap are both invisible. */}
            <div className="relative h-full w-1/2 shrink-0">
              <Image
                src="/onboarding/globe-gold-map.png"
                alt=""
                fill
                sizes="240px"
                className="object-cover"
              />
            </div>
          </div>

          {/* Spherical shading: warm top-left highlight + edge limb darkening */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 34% 28%, color-mix(in oklch, var(--primary) 30%, transparent) 0%, transparent 44%), radial-gradient(circle at 50% 50%, transparent 50%, rgba(0,0,0,0.5) 80%, rgba(0,0,0,0.9) 100%)",
            }}
          />
        </div>

        {/* Atmospheric gold rim */}
        <div className="pointer-events-none absolute inset-0 rounded-full border border-primary/40 shadow-[inset_0_0_26px_color-mix(in_oklch,var(--primary)_25%,transparent)]" />
      </div>

      {/* Floating language glyph bubbles */}
      <GlyphBubble glyph="A" className="left-[-4%] top-[30%]" delay={0} />
      <GlyphBubble glyph="文" className="right-[-4%] top-[44%]" delay={1.4} />
    </motion.div>
  )
}

function GlyphBubble({
  glyph,
  className,
  delay,
}: {
  glyph: string
  className: string
  delay: number
}) {
  return (
    <div className={`animate-bubble absolute ${className}`} style={{ animationDelay: `${delay}s` }}>
      <div className="glass elevate relative flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/30 text-lg font-bold text-foreground shadow-[0_0_18px_color-mix(in_oklch,var(--primary)_25%,transparent)]">
        {glyph}
        {/* little speech-bubble tail */}
        <span className="glass absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[3px] border-b border-r border-primary/30" />
      </div>
    </div>
  )
}

/** Static particle field — positions chosen for a balanced scatter. */
const PARTICLES = [
  { top: "6%", left: "22%", size: 4, delay: 0 },
  { top: "14%", left: "80%", size: 3, delay: 0.6 },
  { top: "72%", left: "10%", size: 3, delay: 1.1 },
  { top: "84%", left: "74%", size: 4, delay: 0.3 },
  { top: "42%", left: "94%", size: 2, delay: 1.6 },
  { top: "28%", left: "3%", size: 2, delay: 0.9 },
  { top: "92%", left: "42%", size: 3, delay: 1.3 },
  { top: "2%", left: "54%", size: 2, delay: 1.9 },
] as const
