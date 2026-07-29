"use client"

import { useEffect, useState } from "react"
import Lottie from "lottie-react"

/**
 * Renders a Lottie animation (e.g. the Telegram glowing-star emoji) as a
 * payment-gateway icon. The animation's own built-in effect (the glow/shine)
 * is preserved and looped; we deliberately add NO extra rotation so it looks
 * exactly like the source clip. Fully transparent background so it drops into
 * the carousel tile like the 3D icons.
 *
 * The JSON is fetched at runtime (kept out of the JS bundle) and cached across
 * mounts so every carousel tile reusing the same source only downloads once.
 */
const cache = new Map<string, Promise<unknown>>()

function loadAnimation(src: string): Promise<unknown> {
  let p = cache.get(src)
  if (!p) {
    p = fetch(src)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Lottie ${r.status}`))))
      .catch((e) => {
        cache.delete(src) // allow a later retry
        throw e
      })
    cache.set(src, p)
  }
  return p
}

export function GatewayLottie({ src }: { src: string }) {
  const [data, setData] = useState<unknown>(null)

  useEffect(() => {
    let alive = true
    loadAnimation(src)
      .then((json) => {
        if (alive) setData(json)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [src])

  if (!data) return <div className="h-full w-full" aria-hidden />

  return (
    <Lottie
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      animationData={data as any}
      loop
      autoplay
      className="h-full w-full"
      rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      aria-hidden
    />
  )
}
