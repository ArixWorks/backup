"use client"

import Image from "next/image"
import { useEffect } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"

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
  const prefersReducedMotion = useReducedMotion()
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const smoothX = useSpring(pointerX, { stiffness: 90, damping: 18, mass: 0.55 })
  const smoothY = useSpring(pointerY, { stiffness: 90, damping: 18, mass: 0.55 })
  const rotateY = useTransform(smoothX, [-1, 1], prefersReducedMotion ? [-2, 2] : [-10, 10])
  const rotateX = useTransform(smoothY, [-1, 1], prefersReducedMotion ? [2, -2] : [8, -8])
  const sceneX = useTransform(smoothX, [-1, 1], prefersReducedMotion ? [-1, 1] : [-7, 7])
  const sceneY = useTransform(smoothY, [-1, 1], prefersReducedMotion ? [-1, 1] : [-5, 5])
  const surfaceX = useMotionValue(0)
  const surfaceTranslate = useTransform(surfaceX, (value) => `${value}%`)

  const requestMotionPermission = () => {
    const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">
    }
    void orientationEvent.requestPermission?.().catch(() => undefined)
  }

  useEffect(() => {
    const rotation = animate(surfaceX, -50, {
      duration: prefersReducedMotion ? 36 : 14,
      ease: "linear",
      repeat: Number.POSITIVE_INFINITY,
      repeatType: "loop",
    })

    const updateFromPoint = (clientX: number, clientY: number) => {
      pointerX.set(Math.max(-1, Math.min(1, (clientX / window.innerWidth) * 2 - 1)))
      pointerY.set(Math.max(-1, Math.min(1, (clientY / window.innerHeight) * 2 - 1)))
    }
    const handlePointerMove = (event: PointerEvent) => updateFromPoint(event.clientX, event.clientY)
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma == null || event.beta == null) return
      pointerX.set(Math.max(-1, Math.min(1, event.gamma / 35)))
      pointerY.set(Math.max(-1, Math.min(1, (event.beta - 45) / 45)))
    }
    const settle = () => {
      pointerX.set(0)
      pointerY.set(0)
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("deviceorientation", handleOrientation, { passive: true })
    window.addEventListener("blur", settle)
    return () => {
      rotation.stop()
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("deviceorientation", handleOrientation)
      window.removeEventListener("blur", settle)
    }
  }, [pointerX, pointerY, prefersReducedMotion, surfaceX])

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 18 }}
      className="relative mx-auto aspect-square h-full max-h-full w-auto max-w-full touch-pan-y [perspective:1000px]"
      style={{ height: "min(100%, 15rem)", x: sceneX, y: sceneY }}
      onPointerDown={requestMotionPermission}
      aria-hidden
    >
      <motion.div className="absolute inset-0 [transform-style:preserve-3d]" style={{ rotateX, rotateY }}>
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
          {/* Rotating surface: two identical seamless equirectangular map tiles
              sliding as one track. Each tile is a flat 2:1 world map; scrolling
              them behind the circular clip + spherical shading reads as the
              planet turning on its axis. */}
          <motion.div className="flex h-full w-[400%] transform-gpu" style={{ x: surfaceTranslate }}>
            <div className="relative h-full w-1/2 shrink-0">
              <Image
                src="/onboarding/globe-gold-equirect.png"
                alt=""
                fill
                sizes="480px"
                className="object-fill"
                priority
              />
            </div>
            {/* Identical twin so the loop wrap is invisible: the equirect map's
                left & right edges connect seamlessly. */}
            <div className="relative h-full w-1/2 shrink-0">
              <Image
                src="/onboarding/globe-gold-equirect.png"
                alt=""
                fill
                sizes="480px"
                className="object-fill"
              />
            </div>
          </motion.div>

          {/* Spherical shading: warm top-left highlight + edge limb darkening */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 32% 26%, color-mix(in oklch, var(--primary) 34%, transparent) 0%, transparent 46%), radial-gradient(circle at 50% 50%, transparent 62%, rgba(0,0,0,0.28) 84%, rgba(0,0,0,0.62) 100%)",
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
