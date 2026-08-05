"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "motion/react"
import { useMotionTier } from "@/components/motion-provider"
import { DomainBadge, type BadgeSpec } from "./domain-badge"

const POSTER = "/domains/globe-poster.webp"
const CLIP = "/domains/globe-loop.mp4"

/**
 * Anchor slots for the extension pills, tuned to the reference composition.
 * Every slot sits outside the globe's circle so a badge never covers the sphere,
 * and the extensions themselves come from the live catalog so a badge can only
 * ever offer a TLD we actually sell.
 */
const ANCHORS: Omit<BadgeSpec, "label">[] = [
  { accent: "violet", top: 6, left: 42, depth: 0.85 },
  { accent: "cyan", top: 24, left: 88, depth: 1 },
  { accent: "indigo", top: 55, left: 7, depth: 0.7 },
  { accent: "violet", top: 74, left: 90, depth: 0.55 },
  { accent: "cyan", top: 92, left: 38, depth: 0.9 },
]

/**
 * The hero globe: a pre-rendered cinematic loop of the rotating digital sphere,
 * cropped to the globe itself and circle-masked so it dissolves into the card.
 * The extension pills are real HTML buttons layered around it rather than baked
 * pixels, so the labels stay crisp, translatable, clickable and accessible.
 *
 * Load strategy, in order of what the user sees:
 *   1. the 16 KB WebP poster paints immediately (no JS required),
 *   2. the 160 KB clip is only requested once the stage scrolls into view, and
 *   3. it cross-fades in on `canplay`, so there is never a flash of black.
 *
 * On the `minimal` motion tier and for reduced-motion users the clip is never
 * downloaded at all - the poster is the final visual.
 */
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const [inView, setInView] = useState(false)
  const [ready, setReady] = useState(false)
  const [fine, setFine] = useState(false)

  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)

  // Pair each anchor slot with a real sellable extension, dropping spare slots.
  const badges = useMemo<BadgeSpec[]>(
    () => ANCHORS.slice(0, tlds.length).map((anchor, index) => ({ ...anchor, label: tlds[index] })),
    [tlds],
  )

  useEffect(() => {
    setFine(window.matchMedia("(pointer: fine)").matches)
  }, [])

  // Defer the download until the stage is close to the viewport.
  useEffect(() => {
    if (!animated) return
    const node = containerRef.current
    if (!node) return
    if (typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [animated])

  // Autoplay can still be refused (data saver, low power mode); the poster stays.
  useEffect(() => {
    if (!inView) return
    const video = videoRef.current
    if (!video) return
    void video.play().catch(() => undefined)
  }, [inView])

  const handleMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!fine || !animated) return
      const rect = event.currentTarget.getBoundingClientRect()
      pointerX.set(Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)))
      pointerY.set(Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1)))
    },
    [fine, animated, pointerX, pointerY],
  )

  const handleLeave = useCallback(() => {
    pointerX.set(0)
    pointerY.set(0)
  }, [pointerX, pointerY])

  const spring = { stiffness: 60, damping: 20 }
  // The bloom drifts further than the clip, so the two planes separate slightly.
  const bloomX = useSpring(useTransform(pointerX, (v) => v * -14), spring)
  const bloomY = useSpring(useTransform(pointerY, (v) => v * -10), spring)
  const clipX = useSpring(useTransform(pointerX, (v) => v * 6), spring)
  const clipY = useSpring(useTransform(pointerY, (v) => v * 4), spring)

  // Circle mask: keeps the sphere, discards the square frame's corners.
  const circleMask =
    "radial-gradient(circle at 50% 50%, #000 80%, rgba(0,0,0,0.55) 92%, transparent 100%)"

  return (
    <div
      ref={containerRef}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className="relative flex w-full flex-col items-center gap-4"
    >
      <div className="relative mx-auto aspect-square w-full max-w-[30rem]">
        {/* Bloom behind the clip; the loop is on near-black so this reads as glow. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 z-[1]"
          style={{ x: animated ? bloomX : 0, y: animated ? bloomY : 0 }}
        >
          <div className="absolute left-1/2 top-1/2 size-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute left-[62%] top-[34%] size-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-2/20 blur-3xl" />
        </motion.div>

        {/* The sphere sits inside the stage so the pills have room to orbit it. */}
        <motion.div
          aria-hidden
          className="absolute inset-[13%] z-[2]"
          style={{ x: animated ? clipX : 0, y: animated ? clipY : 0 }}
        >
          {/* Poster paints first and stays visible underneath until the clip is ready. */}
          <img
            src={POSTER}
            alt=""
            width={448}
            height={448}
            // The mask must sit on the media itself; masking only the wrapper
            // leaves the child painting its own square edges on top.
            style={{ maskImage: circleMask, WebkitMaskImage: circleMask }}
            className="absolute inset-0 size-full object-cover"
          />
          {animated ? (
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload="none"
              poster={POSTER}
              disablePictureInPicture
              src={inView ? CLIP : undefined}
              onCanPlay={() => setReady(true)}
              style={{ maskImage: circleMask, WebkitMaskImage: circleMask }}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
            />
          ) : null}
        </motion.div>

        {/* Real, translatable, clickable extension pills orbiting the sphere. */}
        <div className="absolute inset-0 z-[3]">
          {badges.map((spec) => (
            <DomainBadge
              key={spec.label}
              spec={spec}
              pointerX={pointerX}
              pointerY={pointerY}
              onSelect={onSelectTld}
              selectLabel={selectLabel}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <strong className="text-balance text-base font-bold md:text-lg">{caption}</strong>
        <span className="text-pretty text-xs text-muted-foreground md:text-sm">{captionHint}</span>
      </div>
    </div>
  )
}
