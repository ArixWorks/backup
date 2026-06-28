"use client"

import Image from "next/image"
import { motion } from "motion/react"

/**
 * Premium "global platform" hero for the language picker.
 *
 * A baked-lit golden globe image slowly yaws inside a tilted orbital ring while
 * gold particles twinkle and two language glyph bubbles ("A" / "文") float at
 * its sides. Everything is pure CSS transform / opacity so it stays at 60fps in
 * the Telegram webview, and every loop is disabled under prefers-reduced-motion
 * (see the .animate-* rules in globals.css).
 */
export function LanguageGlobe() {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 18 }}
      className="relative mx-auto h-48 w-48 [perspective:900px]"
      aria-hidden
    >
      {/* Ambient glow behind the globe */}
      <div className="animate-glow absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_45%,transparent)_0%,transparent_68%)] blur-xl" />

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

      {/* Tilted orbital ring (Saturn-style sweep around the globe) */}
      <div className="absolute inset-0 [transform:rotateX(74deg)] [transform-style:preserve-3d]">
        <div className="animate-orbit absolute inset-[14%] rounded-full">
          <div className="absolute inset-0 rounded-full border border-primary/35" />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: "2px solid transparent",
              background:
                "linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 90%, transparent), transparent) border-box",
              WebkitMask:
                "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
          {/* Comet highlight travelling the ring */}
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_12px_3px_color-mix(in_oklch,var(--primary)_80%,transparent)]" />
        </div>
      </div>

      {/* The globe */}
      <div className="absolute inset-[12%] [transform-style:preserve-3d]">
        <div className="animate-globe relative h-full w-full">
          <Image
            src="/onboarding/globe-gold.png"
            alt=""
            fill
            sizes="160px"
            className="object-contain drop-shadow-[0_8px_30px_color-mix(in_oklch,var(--primary)_35%,transparent)]"
            priority
          />
        </div>
      </div>

      {/* Floating language glyph bubbles */}
      <GlyphBubble glyph="A" className="left-[-6%] top-[34%]" delay={0} />
      <GlyphBubble glyph="文" className="right-[-6%] top-[46%]" delay={1.4} />
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
      <div className="glass relative flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 text-lg font-bold text-foreground elevate">
        {glyph}
        {/* little speech-bubble tail */}
        <span className="glass absolute -bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-[3px] border-b border-r border-primary/25" />
      </div>
    </div>
  )
}

/** Static particle field — positions chosen for a balanced scatter. */
const PARTICLES = [
  { top: "8%", left: "20%", size: 4, delay: 0 },
  { top: "16%", left: "78%", size: 3, delay: 0.6 },
  { top: "70%", left: "10%", size: 3, delay: 1.1 },
  { top: "82%", left: "72%", size: 4, delay: 0.3 },
  { top: "40%", left: "92%", size: 2, delay: 1.6 },
  { top: "30%", left: "4%", size: 2, delay: 0.9 },
  { top: "90%", left: "40%", size: 3, delay: 1.3 },
] as const
