"use client"

import createGlobe from "cobe"
import { useEffect, useRef } from "react"

const COMBOS = [
  { diffuse: 1.5, mapBrightness: 10, base: 0.85 },
  { diffuse: 0.6, mapBrightness: 6, base: 0.85 },
  { diffuse: 0.3, mapBrightness: 5, base: 1 },
  { diffuse: 0.3, mapBrightness: 3, base: 1.15 },
  { diffuse: 0, mapBrightness: 4, base: 1 },
  { diffuse: 0, mapBrightness: 2.5, base: 1.15 },
]

// Theme primary (violet) sampled as linear RGB, matching globe-pulse.
const PRIMARY: [number, number, number] = [0.52, 0.36, 0.93]

function Cell({ diffuse, mapBrightness, base }: { diffuse: number; mapBrightness: number; base: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    // Mirror globe-pulse exactly: CSS-pixel width plus a devicePixelRatio.
    const width = canvas.offsetWidth
    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width,
      height: width,
      phi: 0,
      theta: 0.2,
      dark: 1,
      diffuse,
      mapSamples: 16000,
      mapBrightness,
      baseColor: PRIMARY.map((c) => Math.min(1, c * base)) as [number, number, number],
      markerColor: [0.75, 0.6, 1],
      glowColor: [0.05, 0.04, 0.09],
      opacity: 0.92,
      markerElevation: 0,
      markers: [{ location: [35.7, 51.4], size: 0.028 }],
      onRender: () => {},
    })
    return () => globe.destroy()
  }, [diffuse, mapBrightness, base])

  return (
    <div className="flex flex-col gap-2">
      <canvas ref={ref} className="aspect-square w-full" />
      <p className="font-mono text-xs text-foreground">{`diffuse ${diffuse} / mb ${mapBrightness} / base x${base}`}</p>
    </div>
  )
}

export default function GlobeLab() {
  return (
    <main className="grid grid-cols-3 gap-6 bg-background p-6">
      {COMBOS.map((c, i) => (
        <Cell key={i} {...c} />
      ))}
    </main>
  )
}
