"use client"

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "motion/react"
import { Globe2 } from "lucide-react"
import { useMotionTier } from "@/components/motion-provider"
import { DomainBadge, type BadgeSpec } from "@/components/domains/hero/domain-badge"
import type { PointerRef } from "@/components/domains/hero/globe-canvas"

/**
 * The interactive globe stage: five parallax depth layers that each respond to
 * the pointer at a different rate.
 *
 *   1 background bloom/stars  2 star dust  3 orbit rings  4 badges  5 globe
 *
 * Layers 2, 3 and 5 live inside the WebGL canvas; 1 and 4 are DOM so the badges
 * stay real, selectable, accessible buttons.
 *
 * The three.js bundle is code-split and only requested once the stage scrolls
 * into view and the resolved motion tier allows animation.
 */

const GlobeCanvas = lazy(() => import("@/components/domains/hero/globe-canvas"))

/**
 * Anchor slots tuned to the reference composition; none of them overlap.
 * Extensions are filled in from the live catalog so a badge can never offer a
 * TLD we do not actually sell.
 */
const ANCHORS: Omit<BadgeSpec, "label">[] = [
  { accent: "violet", top: 8, left: 50, depth: 0.85 },
  { accent: "cyan", top: 29, left: 86, depth: 1 },
  { accent: "indigo", top: 48, left: 12, depth: 0.7 },
  { accent: "violet", top: 68, left: 83, depth: 0.55 },
  { accent: "cyan", top: 82, left: 23, depth: 0.9 },
]

export function GlobeStage({
  tlds,
  onSelectTld,
  selectLabel,
  caption,
  captionHint,
}: {
  tlds: string[]
  onSelectTld: (tld: string) => void
  selectLabel: string
  caption: string
  captionHint: string
}) {
  const tier = useMotionTier()
  const animated = tier !== "minimal"

  const containerRef = useRef<HTMLDivElement>(null)
  // Imperative pointer channel for the WebGL frame loop - never React state.
  const pointer = useRef<PointerRef>({ x: 0, y: 0 })
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const [visible, setVisible] = useState(false)
  const [fine, setFine] = useState(false)

  useEffect(() => {
    setFine(window.matchMedia("(pointer: fine)").matches)
  }, [])

  // Only pay for the WebGL chunk + context once the stage is actually on screen.
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "200px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!fine || !animated) return
      const rect = event.currentTarget.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1
      pointer.current.x = Math.max(-1, Math.min(1, x))
      pointer.current.y = Math.max(-1, Math.min(1, y))
      pointerX.set(pointer.current.x)
      pointerY.set(pointer.current.y)
    },
    [fine, animated, pointerX, pointerY],
  )

  // Pointer gone: everything eases back to its resting pose.
  const handleLeave = useCallback(() => {
    pointer.current.x = 0
    pointer.current.y = 0
    pointerX.set(0)
    pointerY.set(0)
  }, [pointerX, pointerY])

  // Layer 1 - background bloom drifts least, reinforcing depth.
  const bloomX = useSpring(useTransform(pointerX, (value) => value * -8), { stiffness: 60, damping: 20 })
  const bloomY = useSpring(useTransform(pointerY, (value) => value * -6), { stiffness: 60, damping: 20 })

  const quality = useMemo(() => (tier === "cinematic" ? "high" : "low"), [tier])

  // Pair each anchor slot with a real sellable extension, dropping any spare slot.
  const badges = useMemo<BadgeSpec[]>(
    () => ANCHORS.slice(0, tlds.length).map((anchor, index) => ({ ...anchor, label: tlds[index] })),
    [tlds],
  )

  return (
    <div
      ref={containerRef}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className="relative flex w-full flex-col items-center gap-4"
    >
      <div className="relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-[26rem] lg:max-w-[30rem]">
        {/* Layer 1: static bloom + faint star grid behind everything. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 z-[1]"
          style={{ x: animated ? bloomX : 0, y: animated ? bloomY : 0 }}
        >
          <div className="absolute left-1/2 top-1/2 size-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute left-[62%] top-[34%] size-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-2/20 blur-3xl" />
        </motion.div>

        {/* Layers 2, 3, 5: star dust, orbit rings and the particle globe. */}
        {animated && visible ? (
          <Suspense fallback={<StaticGlobe />}>
            <GlobeCanvas pointer={pointer} quality={quality} />
          </Suspense>
        ) : (
          <StaticGlobe />
        )}

        {/* Layer 4: the real, clickable extension badges. */}
        {badges.map((spec) => (
          <DomainBadge
            key={spec.label}
            spec={spec}
            pointerX={pointerX}
            pointerY={pointerY}
            interactive={animated}
            onSelect={onSelectTld}
            selectLabel={selectLabel}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <strong className="text-balance text-base font-bold md:text-lg">{caption}</strong>
        <span className="text-pretty text-xs text-muted-foreground md:text-sm">{captionHint}</span>
      </div>
    </div>
  )
}

/**
 * Zero-WebGL stand-in used while the canvas chunk streams in and as the
 * permanent visual for the minimal motion tier / reduced-motion users.
 */
function StaticGlobe() {
  return (
    <div aria-hidden className="absolute inset-0 z-[2] flex items-center justify-center">
      <div className="relative flex size-[62%] items-center justify-center rounded-full border border-primary/30 bg-[radial-gradient(circle_at_35%_30%,var(--color-primary)/0.45,transparent_70%)]">
        <span className="absolute inset-0 rounded-full border border-dashed border-chart-2/25" />
        <span className="absolute -inset-[18%] rounded-full border border-dashed border-primary/15" />
        <Globe2 className="size-1/3 text-primary/80" />
      </div>
    </div>
  )
}
