"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motionValue } from "motion/react"
import { useMotionTier } from "@/components/motion-provider"
import { BADGE_ACCENTS, DomainBadge, TldPill } from "./domain-badge"
// Type-only: erased at build time, so three.js never reaches the main bundle.
import type { BadgeProjection, DragState } from "./globe-scene"

/** The WebGL scene (and all of three.js) is fetched only when it is needed. */
const GlobeScene = dynamic(() => import("./globe-scene"), { ssr: false })

/** Anchor slots available in 3D; we use as many as we have sellable TLDs. */
const MAX_BADGES = 5

/** Past this much travel a pointer gesture counts as a drag, not a click. */
const DRAG_SLOP = 8

/**
 * The hero globe: a real-time WebGL sphere the user can spin.
 *
 * The sphere is a shader-driven point shell with a fresnel-lit core and three
 * counter-rotating orbit rings. Drag with a mouse or swipe horizontally to
 * rotate it - the gesture carries real momentum and coasts to a stop, and at
 * rest the globe keeps a slow idle drift and leans toward the cursor.
 *
 * The extension pills are pinned to true 3D anchors: the frame loop projects
 * each one to screen space, so they orbit with the sphere and dim as they swing
 * behind it, while staying real <button>s that are crisp, translatable and
 * focusable. Vertical touch scrolling is preserved (`touch-action: pan-y`), so
 * the globe never traps the page inside the Telegram Mini App.
 *
 * Cost control: the scene is dynamically imported and only mounted once the
 * stage scrolls into view. On the `minimal` motion tier (and for reduced-motion
 * users) it is never downloaded at all - they get a static CSS sphere instead.
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
  const [inView, setInView] = useState(false)
  const [ready, setReady] = useState(false)

  const visible = useMemo(() => tlds.slice(0, MAX_BADGES), [tlds])

  // One stable set of motion values per anchor. `motionValue()` is the
  // non-hook factory, so the count can be fixed without conditional hooks.
  const projections = useMemo<BadgeProjection[]>(
    () =>
      Array.from({ length: MAX_BADGES }, () => ({
        x: motionValue(0),
        y: motionValue(0),
        scale: motionValue(0.9),
        opacity: motionValue(0),
        depth: motionValue(10),
      })),
    [],
  )

  // Live gesture state, read by the WebGL frame loop.
  const drag = useRef<DragState>({
    dragging: false,
    dx: 0,
    dy: 0,
    hx: 0,
    hy: 0,
    hovering: false,
  })
  const last = useRef({ x: 0, y: 0 })
  const travelled = useRef(0)

  // Defer the three.js chunk until the stage is near the viewport.
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

  // A drag that ends on top of a pill must not also trigger its click. The
  // guard runs in the capture phase so it beats the button's own handler.
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const guard = (event: MouseEvent) => {
      if (travelled.current > DRAG_SLOP) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    node.addEventListener("click", guard, true)
    return () => node.removeEventListener("click", guard, true)
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!animated || !inView) return
      drag.current.dragging = true
      drag.current.hovering = true
      last.current = { x: event.clientX, y: event.clientY }
      travelled.current = 0
      // Capture so the gesture keeps tracking outside the element.
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    [animated, inView],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!animated) return
      const state = drag.current
      if (state.dragging) {
        const dx = event.clientX - last.current.x
        const dy = event.clientY - last.current.y
        state.dx += dx
        state.dy += dy
        travelled.current += Math.abs(dx) + Math.abs(dy)
        last.current = { x: event.clientX, y: event.clientY }
        return
      }
      // Idle hover lean, normalized to -1..1 across the stage.
      const rect = event.currentTarget.getBoundingClientRect()
      state.hovering = true
      state.hx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1))
      state.hy = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1))
    },
    [animated],
  )

  const endDrag = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    drag.current.dragging = false
    if (event) event.currentTarget.releasePointerCapture?.(event.pointerId)
  }, [])

  const onPointerLeave = useCallback(() => {
    drag.current.dragging = false
    drag.current.hovering = false
    drag.current.hx = 0
    drag.current.hy = 0
  }, [])

  return (
    <div className="relative flex w-full flex-col items-center gap-4">
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onPointerLeave}
        // pan-y keeps vertical page scrolling working on touch: a horizontal
        // swipe spins the globe, a vertical one still scrolls the page.
        style={{ touchAction: "pan-y" }}
        className={`relative mx-auto aspect-square w-full max-w-[30rem] select-none ${
          animated ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        {/* Bloom behind the sphere so the additive glow has something to sit on. */}
        <div aria-hidden className="absolute inset-0 z-0">
          <div className="absolute left-1/2 top-1/2 size-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        </div>

        {animated && inView ? (
          <div
            className={`absolute inset-0 z-[1] transition-opacity duration-1000 ${
              ready ? "opacity-100" : "opacity-0"
            }`}
          >
            <GlobeScene
              quality={tier === "cinematic" ? "high" : "low"}
              drag={drag}
              projections={projections}
              onReady={() => setReady(true)}
            />
          </div>
        ) : null}

        {!animated ? <StaticSphere /> : null}

        {/* Pills orbit in 3D on the animated path. */}
        {animated ? (
          <div className="absolute inset-0 z-[2]">
            {visible.map((label, index) => (
              <DomainBadge
                key={label}
                label={label}
                accent={BADGE_ACCENTS[index] ?? "violet"}
                projection={projections[index]}
                onSelect={onSelectTld}
                selectLabel={selectLabel}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Reduced motion gets an honest static row instead of faked depth. */}
      {!animated ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {visible.map((label, index) => (
            <TldPill
              key={label}
              label={label}
              accent={BADGE_ACCENTS[index] ?? "violet"}
              onSelect={onSelectTld}
              selectLabel={selectLabel}
            />
          ))}
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-1 text-center">
        <strong className="text-balance text-base font-bold md:text-lg">{caption}</strong>
        <span className="text-pretty text-xs text-muted-foreground md:text-sm">{captionHint}</span>
      </div>
    </div>
  )
}

/** Zero-JS sphere for the minimal tier: no WebGL, no video, no download. */
function StaticSphere() {
  return (
    <div aria-hidden className="absolute inset-[14%] z-[1]">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 34% 28%, oklch(0.72 0.19 305 / 0.55), oklch(0.45 0.16 285 / 0.35) 42%, oklch(0.22 0.07 275 / 0.6) 72%, transparent 78%)",
          boxShadow: "inset 0 0 60px -10px oklch(0.78 0.13 195 / 0.5)",
        }}
      />
      <div className="absolute inset-0 rounded-full border border-[color:oklch(0.78_0.13_195_/_0.3)]" />
      <div className="absolute left-1/2 top-1/2 h-[36%] w-[112%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[color:oklch(0.72_0.19_305_/_0.28)]" />
    </div>
  )
}
