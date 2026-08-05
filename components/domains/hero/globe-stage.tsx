"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "motion/react"
import { useMotionTier } from "@/components/motion-provider"

const POSTER = "/domains/globe-poster.webp"
const CLIP = "/domains/globe-loop.mp4"

/**
 * The hero globe: a pre-rendered cinematic loop (rotating digital globe, orbit
 * rings and extension badges) layered over a soft bloom that drifts with the
 * pointer for a touch of depth.
 *
 * Load strategy, in order of what the user sees:
 *   1. the 16 KB WebP poster paints immediately (no JS required),
 *   2. the 320 KB clip is only requested once the stage scrolls into view, and
 *   3. it cross-fades in on `canplay`, so there is never a flash of black.
 *
 * On the `minimal` motion tier and for reduced-motion users the clip is never
 * downloaded at all - the poster is the final visual.
 */
export function GlobeStage({ caption, captionHint }: { caption: string; captionHint: string }) {
  const tier = useMotionTier()
  const animated = tier !== "minimal"

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [inView, setInView] = useState(false)
  const [ready, setReady] = useState(false)
  const [fine, setFine] = useState(false)

  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)

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

  return (
    <div
      ref={containerRef}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className="relative flex w-full flex-col items-center gap-4"
    >
      <div className="relative mx-auto aspect-video w-full max-w-[34rem]">
        {/* Bloom behind the clip; the loop is on near-black so this reads as glow. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 z-[1]"
          style={{ x: animated ? bloomX : 0, y: animated ? bloomY : 0 }}
        >
          <div className="absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute left-[64%] top-[32%] size-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-2/20 blur-3xl" />
        </motion.div>

        <motion.div
          className="absolute inset-0 z-[2]"
          style={{ x: animated ? clipX : 0, y: animated ? clipY : 0 }}
        >
          {/* Poster paints first and stays visible underneath until the clip is ready. */}
          <img
            src={POSTER}
            alt=""
            aria-hidden
            width={768}
            height={432}
            className="absolute inset-0 size-full object-contain"
          />
          {animated ? (
            <video
              ref={videoRef}
              // Decorative: every extension shown is also a real chip below.
              aria-hidden
              muted
              loop
              playsInline
              preload="none"
              poster={POSTER}
              disablePictureInPicture
              src={inView ? CLIP : undefined}
              onCanPlay={() => setReady(true)}
              className={`absolute inset-0 size-full object-contain transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
            />
          ) : null}
        </motion.div>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <strong className="text-balance text-base font-bold md:text-lg">{caption}</strong>
        <span className="text-pretty text-xs text-muted-foreground md:text-sm">{captionHint}</span>
      </div>
    </div>
  )
}
