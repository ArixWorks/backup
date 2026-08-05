"use client"

import { useEffect, useMemo, useRef } from "react"
import createGlobe from "cobe"
import { TldPill } from "./domain-badge"

type Rgb = [number, number, number]

/** Lat/lon anchors, spread across the map so the pills never crowd together. */
const ANCHORS: [number, number][] = [
  [51.51, -0.13], // London
  [40.71, -74.01], // New York
  [35.68, 139.65], // Tokyo
  [-33.87, 151.21], // Sydney
  [-23.55, -46.63], // Sao Paulo
]

const RAD = Math.PI / 180
/** Idle spin, in radians per second. */
const AUTO_SPIN = 0.16

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function latLonToVec3([lat, lon]: [number, number]) {
  const la = lat * RAD
  const lo = lon * RAD - Math.PI
  const c = Math.cos(la)
  return [-c * Math.cos(lo), Math.sin(la), c * Math.sin(lo)] as const
}

/**
 * Mirrors cobe's internal marker projection.
 *
 * cobe can expose marker anchors via CSS anchor positioning, but that API is
 * not Baseline yet (Safari 26+, Firefox 147+) and iOS Telegram rides the system
 * WebView - so the labels would pile up in one corner for a big slice of real
 * users. Projecting the same maths here keeps every pill glued to its marker in
 * every browser.
 */
function project(v: readonly [number, number, number], phi: number, theta: number, aspect: number) {
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const cosP = Math.cos(phi)
  const sinP = Math.sin(phi)
  const sx = cosP * v[0] + sinP * v[2]
  const sy = sinP * sinT * v[0] + cosT * v[1] - cosP * sinT * v[2]
  return {
    x: (sx / aspect + 1) / 2,
    y: (-sy + 1) / 2,
    // Positive when the marker faces the camera; drives the fade behind the globe.
    depth: -sinP * cosT * v[0] + sinT * v[1] + cosP * cosT * v[2],
  }
}

/**
 * Resolves a theme custom property to normalised RGB for cobe.
 *
 * Goes through canvas so modern colour spaces (the theme ships `oklch`) are
 * converted by the browser instead of hand-rolling a colour-space transform.
 */
function resolveToken(host: Element, token: string, fallback: Rgb): Rgb {
  const raw = getComputedStyle(host).getPropertyValue(token).trim()
  if (!raw) return fallback
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) return fallback
  // Canvas silently ignores an unparseable colour, so probe from two different
  // seeds: matching results prove the assignment actually took effect.
  ctx.fillStyle = "#ff0000"
  ctx.fillStyle = raw
  const first = ctx.fillStyle
  ctx.fillStyle = "#00ff00"
  ctx.fillStyle = raw
  if (first !== ctx.fillStyle) return fallback
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r / 255, g / 255, b / 255]
}

export default function GlobePulse({
  tlds,
  onSelectTld,
  selectLabel,
  quality,
}: {
  tlds: string[]
  onSelectTld: (tld: string) => void
  selectLabel: string
  quality: "balanced" | "cinematic"
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])

  const phi = useRef(0)
  const theta = useRef(0.22)
  const vel = useRef({ phi: 0, theta: 0 })
  const pending = useRef({ dx: 0, dy: 0 })
  const drag = useRef({ active: false, x: 0, y: 0, moved: 0 })
  const hovering = useRef(false)

  // Key on the TLDs' CONTENT, not the array identity. Callsites commonly build
  // this prop inline (`.slice().map()`), which yields a fresh array on every
  // parent render - and the parent re-renders on each search-box keystroke.
  // Keying on the reference would therefore invalidate `markers` constantly and
  // re-run the globe effect below, tearing down and rebuilding the WebGL context
  // mid-typing. Safe to join on "," because a TLD never contains one.
  const markerKey = tlds.slice(0, ANCHORS.length).join(",")
  const markers = useMemo(
    () =>
      markerKey
        .split(",")
        .filter(Boolean)
        .map((tld, i) => ({
          tld,
          location: ANCHORS[i],
          vec: latLonToVec3(ANCHORS[i]),
        })),
    [markerKey],
  )

  // A drag that ends on a pill must not also select it.
  const handleSelect = (tld: string) => {
    if (drag.current.moved > 8) return
    onSelectTld(tld)
  }

  useEffect(() => {
    const host = hostRef.current
    const canvasHost = canvasHostRef.current
    if (!host || !canvasHost) return

    let globe: ReturnType<typeof createGlobe> | null = null
    let canvas: HTMLCanvasElement | null = null
    let raf = 0
    let last = 0
    let width = 0
    let running = false
    let disposed = false

    const colors = {
      base: [0.3, 0.32, 0.38] as Rgb,
      marker: [0.55, 0.6, 0.95] as Rgb,
      glow: [0.06, 0.07, 0.1] as Rgb,
    }

    function readTheme() {
      const primary = resolveToken(host!, "--primary", [0.55, 0.6, 0.95])
      // Markers sit brighter than the landmass so the pinned TLDs stay legible.
      colors.marker = primary.map((c) => Math.min(1, c * 1.25 + 0.1)) as Rgb
      // cobe's reference uses a flat mid-grey [0.5, 0.5, 0.5] here. Pulling the
      // primary TOWARD 0.5 rather than scaling it keeps that mid luminance - so
      // the land dots stay crisp - while still tinting the landmass violet.
      // Plain scaling darkens the green channel and the globe goes muddy.
      colors.base = primary.map((c) => 0.5 + (c - 0.5) * 0.55) as Rgb
      // Near-black atmosphere, as in the reference: a bright glow fogs the limb
      // and eats the dot detail around the edge.
      colors.glow = primary.map((c) => c * 0.09) as Rgb
    }

    function build() {
      const next = host!.clientWidth
      if (!next || disposed) return
      width = next

      globe?.destroy()
      globe = null
      // cobe wraps the canvas in its own div, so a fresh canvas each rebuild
      // keeps those wrappers from nesting one level deeper every resize.
      canvasHost!.replaceChildren()
      canvas = document.createElement("canvas")
      // No touch-action here: the host element owns it, and `none` on the canvas
      // would block vertical page scrolling.
      canvas.style.cssText =
        "width:100%;height:100%;display:block;border-radius:50%;opacity:0;transition:opacity .9s ease"
      canvasHost!.append(canvas)

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, quality === "cinematic" ? 2 : 1.5),
        width,
        height: width,
        phi: phi.current,
        theta: theta.current,
        // Full dark keeps a real terminator across the sphere, which is what
        // gives it volume; lifting it flattens the globe into a disc.
        dark: 1,
        diffuse: 1.5,
        mapSamples: quality === "cinematic" ? 16000 : 9000,
        // Pairs with a mid-luminance baseColor to make the land dots crisp.
        mapBrightness: 10,
        baseColor: colors.base,
        markerColor: colors.marker,
        glowColor: colors.glow,
        // Slightly translucent, as in the reference: it lets the page background
        // sit through the sphere so it reads as atmosphere rather than a decal.
        opacity: 0.72,
        markerElevation: 0,
        markers: markers.map((m) => ({ location: m.location, size: 0.028 })),
      })
      requestAnimationFrame(() => {
        if (canvas) canvas.style.opacity = "1"
      })
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016
      last = now

      const d = drag.current
      const p = pending.current
      if (d.active) {
        // Direct 1:1 tracking while held, and the same delta seeds the velocity
        // so releasing mid-flick coasts instead of stopping dead.
        phi.current += p.dx * 0.0065
        theta.current = clamp(theta.current + p.dy * 0.005, -0.85, 0.85)
        if (dt > 0) {
          vel.current.phi = clamp((p.dx * 0.0065) / dt, -7, 7)
          vel.current.theta = clamp((p.dy * 0.005) / dt, -4, 4)
        }
        p.dx = 0
        p.dy = 0
      } else {
        phi.current += vel.current.phi * dt
        theta.current = clamp(theta.current + vel.current.theta * dt, -0.85, 0.85)
        // Damp per second, not per frame, so the coast feels identical at 30fps
        // and 120fps.
        const damp = Math.pow(0.0025, dt)
        vel.current.phi *= damp
        vel.current.theta *= damp
        // Hovering pauses the drift so a pill can actually be clicked.
        if (!hovering.current) phi.current += AUTO_SPIN * dt
      }

      globe?.update({
        phi: phi.current,
        theta: theta.current,
        baseColor: colors.base,
        markerColor: colors.marker,
        glowColor: colors.glow,
      })

      for (let i = 0; i < markers.length; i++) {
        const el = slotRefs.current[i]
        if (!el) continue
        const pr = project(markers[i].vec, phi.current, theta.current, 1)
        // Keyboard focus forces full visibility: the inline opacity below would
        // otherwise leave a focus ring at ~12% on the far side of the globe,
        // failing WCAG 2.4.7.
        const focused = el.contains(document.activeElement)
        const t = focused ? 1 : clamp((pr.depth + 0.05) / 0.35, 0, 1)
        el.style.left = `${pr.x * 100}%`
        el.style.top = `${pr.y * 100}%`
        el.style.transform = `translate(-50%, -50%) scale(${(0.86 + 0.14 * t).toFixed(3)})`
        el.style.opacity = (0.1 + 0.9 * t).toFixed(3)
        el.style.filter = t > 0.97 ? "none" : `blur(${((1 - t) * 5).toFixed(2)}px)`
        el.style.pointerEvents = t > 0.6 ? "auto" : "none"
        el.style.zIndex = `${10 + Math.round(t * 20)}`
      }
    }

    function start() {
      if (running || disposed) return
      running = true
      last = 0
      raf = requestAnimationFrame(frame)
    }

    function stop() {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    readTheme()

    // Wait for a real width before creating the GL context.
    const ro = new ResizeObserver(() => {
      const next = host.clientWidth
      if (!next) return
      if (!globe) {
        build()
        start()
        return
      }
      if (Math.abs(next - width) > 1) build()
    })
    ro.observe(host)

    // Only burn frames while the globe is actually on screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && document.visibilityState === "visible") start()
        else stop()
      },
      { rootMargin: "120px" },
    )
    io.observe(host)

    const onVisibility = () => {
      if (document.visibilityState === "visible") start()
      else stop()
    }
    document.addEventListener("visibilitychange", onVisibility)

    // Keep the globe in step with the active site theme.
    const themeObserver = new MutationObserver(readTheme)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    })

    return () => {
      disposed = true
      stop()
      ro.disconnect()
      io.disconnect()
      themeObserver.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      globe?.destroy()
      canvasHost.replaceChildren()
    }
  }, [markers, quality])

  // Pointer drag. Move/up live on the window so a drag that leaves the globe
  // still tracks and still releases.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current
      if (!d.active) return
      pending.current.dx += e.clientX - d.x
      pending.current.dy += e.clientY - d.y
      d.moved += Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y)
      d.x = e.clientX
      d.y = e.clientY
    }
    const onUp = () => {
      if (!drag.current.active) return
      drag.current.active = false
      const host = hostRef.current
      if (host) host.style.cursor = "grab"
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("pointerup", onUp, { passive: true })
    window.addEventListener("pointercancel", onUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [])

  return (
    <div
      ref={hostRef}
      onPointerDown={(e) => {
        drag.current = { active: true, x: e.clientX, y: e.clientY, moved: 0 }
        e.currentTarget.style.cursor = "grabbing"
      }}
      onPointerEnter={() => {
        hovering.current = true
      }}
      onPointerLeave={() => {
        hovering.current = false
      }}
      // pan-y keeps the page scrollable on touch: a horizontal swipe spins the
      // globe, a vertical one still scrolls, so the Mini App never traps the
      // user inside the canvas.
      style={{ touchAction: "pan-y" }}
      className="relative aspect-square w-full cursor-grab select-none"
    >
      <div ref={canvasHostRef} className="absolute inset-0" aria-hidden="true" />

      {/* Layer is transparent to pointers so the whole globe stays draggable;
          each pill re-enables them for itself once it is facing the camera. */}
      <div className="pointer-events-none absolute inset-0">
        {markers.map((m, i) => (
          <div
            key={m.tld}
            ref={(el) => {
              slotRefs.current[i] = el
            }}
            className="absolute top-1/2 left-1/2 will-change-transform"
          >
            <TldPill tld={m.tld} selectLabel={selectLabel} onSelect={handleSelect} />
          </div>
        ))}
      </div>
    </div>
  )
}
