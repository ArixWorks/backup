"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { MotionValue } from "motion/react"

/**
 * useDeviceTilt — a reusable Motion Engine input that turns a phone's physical
 * orientation into a subtle 3D tilt, and writes it straight into the caller's
 * existing tilt `MotionValue`s (rotateX/rotateY degrees + a few px of parallax
 * translate). It never calls React state per frame, so it is free to run at the
 * sensor's refresh rate without re-rendering the tree.
 *
 * Input priority:
 *   1. Telegram `WebApp.DeviceOrientation` (Bot API 8.0+, radians) — the target
 *      surface for the Mini App.
 *   2. The standard `DeviceOrientationEvent` (degrees) as a progressive
 *      enhancement on plain mobile web.
 * Anything else (desktop, no sensor, SSR) reports `supported: false` and the
 * caller simply keeps its existing pointer / static behavior.
 *
 * Permissions / activation (per product decision):
 *   • Android starts silently on mount.
 *   • iOS needs a user gesture, so the caller invokes `enable()` on first touch.
 *
 * Idle behavior: the tilt is calibrated ONCE to the orientation at start, then
 * tracks the *deviation* from that baseline — so when the phone is held still
 * the card holds the matching angle (no spring-back to flat).
 */

export type DeviceTiltOptions = {
  /** Card tilt around X (deg) — front/back phone tilt. */
  rx: MotionValue<number>
  /** Card tilt around Y (deg) — left/right phone tilt. */
  ry: MotionValue<number>
  /** Whole-card parallax translate X (px). */
  tx: MotionValue<number>
  /** Whole-card parallax translate Y (px). */
  ty: MotionValue<number>
  /** Master gate (e.g. tier !== "minimal" && !reduced-motion). */
  enabled?: boolean
  maxRotateX?: number
  maxRotateY?: number
  maxTranslate?: number
  /** Exponential smoothing factor per frame (0..1, higher = snappier). */
  smoothing?: number
  /** Telegram sensor refresh rate (ms). */
  refreshRate?: number
  /** Degrees of physical tilt that map to the full rotation range. */
  referenceTilt?: number
}

export type DeviceTiltState = {
  /** A usable orientation source exists in this environment. */
  supported: boolean
  /** Sensor has delivered real data and is driving the motion values. */
  active: boolean
  /** iOS-style gesture is still required before it can start. */
  needsGesture: boolean
  /** iOS permission was denied or no sensor data arrived. */
  permissionDenied: boolean
  /** Start the sensor (safe to call repeatedly; required on iOS). */
  enable: () => void
  /** Stop the sensor and release listeners. */
  disable: () => void
}

const RAD_TO_DEG = 180 / Math.PI

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v
}

function isIOS(platform: string | null): boolean {
  if (platform === "ios") return true
  if (typeof navigator === "undefined") return false
  return /iP(hone|ad|od)/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function detectSupport(): { supported: boolean; kind: "telegram" | "web" | null; platform: string | null } {
  if (typeof window === "undefined") return { supported: false, kind: null, platform: null }
  const wa = window.Telegram?.WebApp
  const platform = wa?.platform ?? null
  const isMobilePlatform = platform === "android" || platform === "ios"
  // Telegram path: only on phones running a client new enough to expose the API.
  if (wa?.DeviceOrientation && isMobilePlatform && (wa.isVersionAtLeast?.("8.0") ?? false)) {
    return { supported: true, kind: "telegram", platform }
  }
  // Progressive web fallback: a real motion sensor on a touch device.
  const hasWebSensor =
    "DeviceOrientationEvent" in window &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  if (hasWebSensor) return { supported: true, kind: "web", platform }
  return { supported: false, kind: null, platform }
}

export function useDeviceTilt(options: DeviceTiltOptions): DeviceTiltState {
  const {
    rx,
    ry,
    tx,
    ty,
    enabled = true,
    maxRotateX = 10,
    maxRotateY = 14,
    maxTranslate = 4,
    smoothing = 0.22,
    refreshRate = 33,
    referenceTilt = 11,
  } = options

  const [supported, setSupported] = useState(false)
  const [active, setActive] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  // Everything the animation loop touches lives in refs so the effect body runs
  // once and never rebinds listeners on a state change.
  const kindRef = useRef<"telegram" | "web" | null>(null)
  const platformRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const readingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest raw reading (degrees) + the calibrated baseline + smoothed output.
  const rawRef = useRef<{ beta: number; gamma: number } | null>(null)
  const baseRef = useRef<{ beta: number; gamma: number } | null>(null)
  const curRef = useRef({ rx: 0, ry: 0, tx: 0, ty: 0 })

  useEffect(() => {
    const { supported: sup, kind, platform } = detectSupport()
    kindRef.current = kind
    platformRef.current = platform
    setSupported(sup)
    setNeedsGesture(sup && isIOS(platform))
  }, [])

  const loop = useCallback(() => {
    const raw = rawRef.current
    if (raw) {
      if (!baseRef.current) baseRef.current = { beta: raw.beta, gamma: raw.gamma }
      const base = baseRef.current
      const gain = 1 / referenceTilt
      const targetRx = clamp(-(raw.beta - base.beta) * gain * maxRotateX, -maxRotateX, maxRotateX)
      const targetRy = clamp((raw.gamma - base.gamma) * gain * maxRotateY, -maxRotateY, maxRotateY)
      const targetTx = clamp((raw.gamma - base.gamma) * gain * maxTranslate, -maxTranslate, maxTranslate)
      const targetTy = clamp((raw.beta - base.beta) * gain * maxTranslate, -maxTranslate, maxTranslate)

      const cur = curRef.current
      cur.rx += (targetRx - cur.rx) * smoothing
      cur.ry += (targetRy - cur.ry) * smoothing
      cur.tx += (targetTx - cur.tx) * smoothing
      cur.ty += (targetTy - cur.ty) * smoothing

      rx.set(cur.rx)
      ry.set(cur.ry)
      tx.set(cur.tx)
      ty.set(cur.ty)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [rx, ry, tx, ty, maxRotateX, maxRotateY, maxTranslate, smoothing, referenceTilt])

  const startLoop = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(loop)
  }, [loop])

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const markReading = useCallback(() => {
    if (readingTimeoutRef.current) {
      clearTimeout(readingTimeoutRef.current)
      readingTimeoutRef.current = null
    }
    setActive(true)
    setNeedsGesture(false)
    setPermissionDenied(false)
  }, [])

  // Telegram sensor event → cache the latest reading (radians → degrees).
  const onTelegramReading = useCallback(() => {
    const d = window.Telegram?.WebApp?.DeviceOrientation
    if (!d) return
    rawRef.current = { beta: (d.beta ?? 0) * RAD_TO_DEG, gamma: (d.gamma ?? 0) * RAD_TO_DEG }
    markReading()
  }, [markReading])

  // Standard web sensor event → already in degrees.
  const onWebReading = useCallback((e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return
    rawRef.current = { beta: e.beta, gamma: e.gamma }
    markReading()
  }, [markReading])

  const disable = useCallback(() => {
    if (!runningRef.current) return
    runningRef.current = false
    stopLoop()
    if (readingTimeoutRef.current) {
      clearTimeout(readingTimeoutRef.current)
      readingTimeoutRef.current = null
    }
    const wa = window.Telegram?.WebApp
    if (kindRef.current === "telegram") {
      wa?.offEvent?.("deviceOrientationChanged", onTelegramReading)
      try {
        wa?.DeviceOrientation?.stop()
      } catch {
        /* ignore */
      }
    } else if (kindRef.current === "web") {
      window.removeEventListener("deviceorientation", onWebReading)
    }
    // Ease the card back to neutral rather than freezing at the last angle.
    baseRef.current = null
    rawRef.current = null
    curRef.current = { rx: 0, ry: 0, tx: 0, ty: 0 }
    rx.set(0)
    ry.set(0)
    tx.set(0)
    ty.set(0)
    setActive(false)
  }, [onTelegramReading, onWebReading, rx, ry, tx, ty, stopLoop])

  const enable = useCallback(() => {
    if (runningRef.current || !kindRef.current) return
    const wa = window.Telegram?.WebApp
    const DOE = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> })
      | undefined

    const attachWeb = () => {
      kindRef.current = "web"
      runningRef.current = true
      window.addEventListener("deviceorientation", onWebReading, true)
      setNeedsGesture(false)
      startLoop()
      readingTimeoutRef.current = setTimeout(() => {
        if (!rawRef.current) {
          disable()
          setPermissionDenied(true)
        }
      }, 1800)
    }

    const requestWeb = () => {
      if (DOE && typeof DOE.requestPermission === "function") {
        DOE.requestPermission()
          .then((res) => {
            if (res === "granted") attachWeb()
            else setPermissionDenied(true)
          })
          .catch(() => setPermissionDenied(true))
      } else if (DOE) {
        attachWeb()
      } else {
        setPermissionDenied(true)
      }
    }

    if (kindRef.current === "telegram") {
      const d = wa?.DeviceOrientation
      if (!d) {
        requestWeb()
        return
      }
      runningRef.current = true
      wa?.onEvent?.("deviceOrientationChanged", onTelegramReading)
      try {
        d.start({ refresh_rate: refreshRate, need_absolute: false }, (ok) => {
          if (!ok) {
            disable()
            requestWeb()
            return
          }
          startLoop()
          readingTimeoutRef.current = setTimeout(() => {
            if (!rawRef.current) {
              disable()
              requestWeb()
            }
          }, 1200)
        })
      } catch {
        disable()
        requestWeb()
      }
      return
    }

    requestWeb()
  }, [disable, onTelegramReading, onWebReading, refreshRate, startLoop])

  // Auto-start on Android (silent); iOS waits for enable() on first touch.
  useEffect(() => {
    if (!supported || !enabled) return
    if (!isIOS(platformRef.current)) enable()
    return () => disable()
    // enable/disable are stable; re-run only when gating inputs change.
  }, [supported, enabled, enable, disable])

  // Pause when the app is hidden / backgrounded; resume when visible again.
  useEffect(() => {
    if (!supported || !enabled) return
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (runningRef.current) disable()
      } else if (!runningRef.current && !isIOS(platformRef.current)) {
        enable()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("blur", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("blur", onVisibility)
    }
  }, [supported, enabled, enable, disable])

  return { supported, active, needsGesture, permissionDenied, enable, disable }
}
