"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useSpring, useTransform, animate } from "motion/react"

export type MascotState = "idle" | "checking" | "passed" | "failed"

/**
 * GuardianMascot — a friendly 2.5D security mascot whose eyes follow the user's
 * pointer (desktop) or touch (mobile), like the MetaMask fox / Telegram login
 * characters. Depth is achieved with layered SVG gradients + soft shadows
 * instead of a heavy 3D/WebGL asset, so it stays buttery on a Telegram Mini App.
 *
 * Reacts to the verification lifecycle:
 *  - idle     → eyes track the cursor/touch, gentle float + periodic blink
 *  - checking → eyes scan side-to-side, a scanner ring sweeps
 *  - passed   → happy curved eyes, green glow, a little celebratory hop
 *  - failed   → brief shake, worried look
 */
export function GuardianMascot({ state = "idle" }: { state?: MascotState }) {
  const wrapRef = useRef<HTMLDivElement>(null)

  // Normalized pointer direction in [-1, 1], smoothed with a spring.
  const dirX = useMotionValue(0)
  const dirY = useMotionValue(0)
  const sx = useSpring(dirX, { stiffness: 140, damping: 16, mass: 0.4 })
  const sy = useSpring(dirY, { stiffness: 140, damping: 16, mass: 0.4 })

  // Max pupil / head travel in SVG units.
  const pupilX = useTransform(sx, (v) => v * 7)
  const pupilY = useTransform(sy, (v) => v * 6)
  // The whole head parallax-tilts a touch toward the pointer for a 3D feel.
  const headX = useTransform(sx, (v) => v * 4)
  const headY = useTransform(sy, (v) => v * 3)
  const headRotate = useTransform(sx, (v) => v * 5)

  const [blink, setBlink] = useState(false)

  // Pointer + touch tracking (only while idle — other states drive the eyes).
  useEffect(() => {
    if (state !== "idle") return
    function move(clientX: number, clientY: number) {
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const nx = (clientX - cx) / (window.innerWidth / 2)
      const ny = (clientY - cy) / (window.innerHeight / 2)
      dirX.set(Math.max(-1, Math.min(1, nx)))
      dirY.set(Math.max(-1, Math.min(1, ny)))
    }
    const onMouse = (e: MouseEvent) => move(e.clientX, e.clientY)
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t) move(t.clientX, t.clientY)
    }
    window.addEventListener("mousemove", onMouse)
    window.addEventListener("touchmove", onTouch, { passive: true })
    return () => {
      window.removeEventListener("mousemove", onMouse)
      window.removeEventListener("touchmove", onTouch)
    }
  }, [state, dirX, dirY])

  // Drive the eyes for non-idle states.
  useEffect(() => {
    if (state === "checking") {
      // Scan left↔right; spring smooths it into a sweep.
      const ctrl = animate(dirX, [-1, 1, -1], {
        duration: 1.6,
        ease: "easeInOut",
        repeat: Infinity,
      })
      animate(dirY, 0.15, { duration: 0.3 })
      return () => ctrl.stop()
    }
    if (state === "passed") {
      animate(dirX, 0, { duration: 0.3 })
      animate(dirY, -0.4, { duration: 0.3 }) // look up, pleased
    }
    if (state === "failed") {
      animate(dirX, 0, { duration: 0.2 })
      animate(dirY, 0.5, { duration: 0.2 }) // look down, worried
    }
  }, [state, dirX, dirY])

  // Natural blinking on a randomized cadence (paused while celebrating).
  useEffect(() => {
    if (state === "passed") return
    let timer: ReturnType<typeof setTimeout>
    const loop = () => {
      timer = setTimeout(
        () => {
          setBlink(true)
          setTimeout(() => setBlink(false), 130)
          loop()
        },
        2200 + Math.random() * 2600,
      )
    }
    loop()
    return () => clearTimeout(timer)
  }, [state])

  const happy = state === "passed"
  const accent =
    state === "passed"
      ? "var(--mascot-ok, #34d399)"
      : state === "failed"
        ? "var(--mascot-bad, #f87171)"
        : "var(--primary)"

  return (
    <div ref={wrapRef} className="relative mx-auto h-44 w-44 select-none" aria-hidden>
      {/* Ambient glow that tints with state */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full blur-2xl"
        animate={{
          backgroundColor: accent,
          opacity: happy ? 0.4 : state === "failed" ? 0.32 : 0.22,
          scale: happy ? 1.1 : 1,
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Floating + state hop/shake wrapper */}
      <motion.div
        className="absolute inset-0"
        animate={
          state === "failed"
            ? { x: [0, -8, 8, -5, 5, 0], y: 0 }
            : happy
              ? { y: [0, -14, 0], x: 0 }
              : { y: [0, -8, 0], x: 0 }
        }
        transition={
          state === "failed"
            ? { duration: 0.45 }
            : happy
              ? { duration: 0.6, ease: "easeOut" }
              : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
        }
      >
        <motion.svg
          viewBox="0 0 200 200"
          className="h-full w-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]"
          style={{ x: headX, y: headY, rotate: headRotate }}
        >
          <defs>
            <radialGradient id="mascot-body" cx="38%" cy="30%" r="80%">
              <stop offset="0%" stopColor="color-mix(in oklch, var(--primary) 55%, white)" />
              <stop offset="55%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="color-mix(in oklch, var(--primary) 55%, black)" />
            </radialGradient>
            <radialGradient id="mascot-face" cx="50%" cy="42%" r="65%">
              <stop offset="0%" stopColor="rgba(8,10,20,0.96)" />
              <stop offset="100%" stopColor="rgba(20,16,38,0.96)" />
            </radialGradient>
            <linearGradient id="mascot-shine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          {/* Antenna */}
          <line x1="100" y1="34" x2="100" y2="14" stroke="url(#mascot-body)" strokeWidth="5" strokeLinecap="round" />
          <motion.circle
            cx="100"
            cy="11"
            r="7"
            fill={accent}
            animate={{ opacity: [0.6, 1, 0.6], r: state === "checking" ? [7, 9, 7] : 7 }}
            transition={{ duration: state === "checking" ? 0.8 : 2, repeat: Infinity }}
          />

          {/* Head shell (rounded-square shield head) */}
          <rect x="34" y="34" width="132" height="128" rx="46" fill="url(#mascot-body)" />
          {/* Glossy top highlight */}
          <rect x="48" y="44" width="104" height="46" rx="28" fill="url(#mascot-shine)" opacity="0.6" />

          {/* Ears / side modules */}
          <rect x="22" y="84" width="16" height="34" rx="8" fill="url(#mascot-body)" />
          <rect x="162" y="84" width="16" height="34" rx="8" fill="url(#mascot-body)" />

          {/* Face screen */}
          <rect x="52" y="58" width="96" height="82" rx="34" fill="url(#mascot-face)" />

          {/* Eyes */}
          <g>
            {happy ? (
              // Happy curved eyes ^_^
              <>
                <path
                  d="M70 96 q12 -16 24 0"
                  fill="none"
                  stroke={accent}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <path
                  d="M106 96 q12 -16 24 0"
                  fill="none"
                  stroke={accent}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <motion.g animate={{ scaleY: blink ? 0.12 : 1 }} transition={{ duration: 0.08 }} style={{ transformOrigin: "100px 96px" }}>
                {/* Eye whites */}
                <circle cx="82" cy="96" r="15" fill="#eaf2ff" />
                <circle cx="118" cy="96" r="15" fill="#eaf2ff" />
                {/* Pupils follow pointer */}
                <motion.g style={{ x: pupilX, y: pupilY }}>
                  <circle cx="82" cy="96" r="7.5" fill="#0b1020" />
                  <circle cx="118" cy="96" r="7.5" fill="#0b1020" />
                  {/* catch-lights */}
                  <circle cx="79.5" cy="93" r="2.4" fill="rgba(255,255,255,0.95)" />
                  <circle cx="115.5" cy="93" r="2.4" fill="rgba(255,255,255,0.95)" />
                </motion.g>
              </motion.g>
            )}
          </g>

          {/* Mouth */}
          <motion.path
            d={happy ? "M86 120 q14 14 28 0" : state === "failed" ? "M88 124 q12 -10 24 0" : "M88 120 q12 7 24 0"}
            fill="none"
            stroke="rgba(234,242,255,0.7)"
            strokeWidth="4"
            strokeLinecap="round"
            transition={{ duration: 0.3 }}
          />

          {/* Shield emblem on the forehead chip */}
          <g transform="translate(100 150)">
            <path
              d="M0 -12 L11 -7 L11 3 C11 10 6 14 0 17 C-6 14 -11 10 -11 3 L-11 -7 Z"
              fill="color-mix(in oklch, var(--primary) 30%, black)"
              stroke={accent}
              strokeWidth="2"
            />
            <motion.path
              d="M-4.5 1 L-1 5 L5 -4"
              fill="none"
              stroke={accent}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ opacity: happy ? 1 : 0.7, pathLength: 1 }}
            />
          </g>

          {/* Scanner sweep while checking */}
          {state === "checking" && (
            <motion.rect
              x="52"
              y="58"
              width="96"
              height="10"
              rx="5"
              fill={accent}
              opacity="0.5"
              initial={{ y: 58 }}
              animate={{ y: [58, 130, 58] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </motion.svg>
      </motion.div>
    </div>
  )
}
