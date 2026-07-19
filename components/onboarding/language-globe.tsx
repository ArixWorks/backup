"use client"

import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo"
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"
import { useEffect, useRef } from "react"
import { feature } from "topojson-client"
import type { GeometryCollection, Topology } from "topojson-specification"
import worldAtlas from "world-atlas/countries-110m.json"

/**
 * Cinematic "global platform" hero for the language picker.
 *
 * A golden globe continuously spins on its axis using Natural Earth geography
 * projected onto a real orthographic sphere. Two counter-rotating orbital rings,
 * gold particles, atmospheric light and interactive pointer/device tilt create
 * depth while the aspect-square container remains safe on short Telegram screens.
 * Canvas rendering is capped at 2x device pixel ratio for crisp, efficient motion.
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
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const requestMotionPermission = () => {
    const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">
    }
    void orientationEvent.requestPermission?.().catch(() => undefined)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext("2d")
    if (!context) return

    const topology = worldAtlas as unknown as Topology<{ countries: GeometryCollection }>
    const countries = feature(topology, topology.objects.countries)
    const sphere = { type: "Sphere" } as const
    const projection = geoOrthographic().clipAngle(90).precision(0.3)
    const path = geoPath(projection, context)
    const startedAt = performance.now()
    let frameId = 0

    const draw = (now: number) => {
      const bounds = canvas.getBoundingClientRect()
      const size = Math.max(1, Math.round(Math.min(bounds.width, bounds.height)))
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const renderSize = Math.round(size * pixelRatio)
      if (canvas.width !== renderSize || canvas.height !== renderSize) {
        canvas.width = renderSize
        canvas.height = renderSize
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, size, size)
      projection
        .translate([size / 2, size / 2])
        .scale(size * 0.49)
        .rotate([((now - startedAt) / (prefersReducedMotion ? 300 : 140)) % 360, smoothY.get() * -5, 0])

      context.beginPath()
      path(sphere)
      context.fillStyle = "#070814"
      context.fill()

      context.beginPath()
      path(geoGraticule10())
      context.strokeStyle = "rgba(139, 113, 255, 0.13)"
      context.lineWidth = 0.45
      context.stroke()

      context.beginPath()
      path(countries)
      context.fillStyle = "#c7a96b"
      context.fill()
      context.strokeStyle = "rgba(247, 224, 166, 0.34)"
      context.lineWidth = 0.35
      context.stroke()

      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)

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
      cancelAnimationFrame(frameId)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("deviceorientation", handleOrientation)
      window.removeEventListener("blur", settle)
    }
  }, [pointerX, pointerY, prefersReducedMotion, smoothY])

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

      {/* Geographic globe rendered from Natural Earth country geometry. Unlike a
          sliding image, the orthographic projection reveals every longitude and
          keeps continents correctly wrapped around the sphere. */}
      <div className="absolute inset-[14%] drop-shadow-[0_10px_36px_color-mix(in_oklch,var(--primary)_40%,transparent)]">
        <div className="relative h-full w-full overflow-hidden rounded-full bg-background">
          <canvas ref={canvasRef} className="h-full w-full" />
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 32% 26%, color-mix(in oklch, var(--primary) 26%, transparent) 0%, transparent 48%), radial-gradient(circle at 50% 50%, transparent 68%, rgba(0,0,0,0.18) 86%, rgba(0,0,0,0.5) 100%)",
            }}
          />
        </div>
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
