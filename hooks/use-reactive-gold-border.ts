"use client"

import { useCallback, useEffect, useState } from "react"

import { useMotionTier } from "@/components/motion-provider"

/**
 * useReactiveGoldBorder — pointer/touch-steered gold border light.
 *
 * Attach the returned ref to any element carrying the `.gold-border-spin`
 * skin. A single rAF loop drives the registered `--gold-angle` custom property
 * (compositor-friendly, no layout thrash):
 *   • While the pointer/finger moves ANYWHERE on the page, the brightest band
 *     of the conic border — and an edge glow — rotate to face the cursor, and
 *     the glow lights the border segment nearest it.
 *   • When idle it falls back to a brisk continuous auto-spin (~full turn every
 *     ~3.8s) so the frame always reads as alive.
 * Shortest-path angle interpolation keeps the transition between pointer
 * steering and idle spin buttery, never snapping.
 *
 * Fully gated on the resolved motion tier: under `minimal` (which already folds
 * in OS Reduce-Motion) the loop never starts and the frame stays a calm static
 * gold border.
 */
export function useReactiveGoldBorder<T extends HTMLElement = HTMLDivElement>() {
  // Callback ref (via state) so setup re-runs when the card node actually
  // mounts — the host page renders a loading skeleton first, so a plain
  // useRef would still be null on the initial effect and never re-attach.
  const [el, setEl] = useState<T | null>(null)
  const ref = useCallback((node: T | null) => setEl(node), [])
  const tier = useMotionTier()
  const active = tier !== "minimal"

  useEffect(() => {
    if (!el || !active) return

    let raf = 0
    let current = 0 // displayed angle (deg)
    let target = 0 // desired angle (deg)
    let idlePhase = 0 // free-running auto-spin accumulator
    let lastPointerTs = -Infinity

    // Shortest-path interpolation across the 0/360 seam.
    const lerpAngle = (a: number, b: number, t: number) => {
      const diff = ((b - a + 540) % 360) - 180
      return a + diff * t
    }

    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      // conic-gradient `from` uses 0deg = top, clockwise-positive. atan2(dx,-dy)
      // maps the vector from the card center to the pointer into that space.
      const deg = (Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180) / Math.PI
      target = (deg + 360) % 360
      lastPointerTs = performance.now()

      // Edge glow anchor: clamp the pointer into the card's own box so the glow
      // rides the border segment closest to the cursor, even from off-card.
      const gx = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))
      const gy = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100))
      el.style.setProperty("--glow-x", `${gx}%`)
      el.style.setProperty("--glow-y", `${gy}%`)
      el.style.setProperty("--glow-o", "1")
    }

    const loop = () => {
      const idle = performance.now() - lastPointerTs > 1200
      if (idle) {
        idlePhase = (idlePhase + 1.6) % 360 // ~96deg/s → ~3.8s per turn
        target = idlePhase
        el.style.setProperty("--glow-o", "0")
      }
      current = lerpAngle(current, target, 0.2)
      el.style.setProperty("--gold-angle", `${current.toFixed(2)}deg`)
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    window.addEventListener("pointermove", onPointer, { passive: true })
    window.addEventListener("pointerdown", onPointer, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onPointer)
      window.removeEventListener("pointerdown", onPointer)
    }
  }, [el, active])

  return ref
}
