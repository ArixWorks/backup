"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, useReducedMotion } from "motion/react"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"

type Phase = "sleep" | "shock" | "ready"

// Calm wake/settle spring — readable, not floaty.
const springWake = { type: "spring", stiffness: 210, damping: 22, mass: 0.9 } as const
// Snappy startle spring — makes the "shock" pop feel instant.
const springShock = { type: "spring", stiffness: 700, damping: 12, mass: 0.5 } as const
const springSoft = { type: "spring", stiffness: 160, damping: 20 } as const
const dozeLoop = { duration: 4.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } as const

/**
 * Always-available customer-support entry point. Icon-only 3D floating action
 * button with a living "support agent" character. Every element is laid out
 * symmetrically around the box centre (24,24 in a 48×48 viewBox) so the icon
 * reads as perfectly centred from a distance in every phase.
 *
 * SLEEP : the agent dozes — head gently breathing, eyes closed, "z z z"
 *         drifting up above the head and fading out on a loop.
 * SHOCK : the instant the pointer arrives (or the button is touched) the agent
 *         is startled awake — the whole head jolts up, the eyes bulge wide and
 *         a bright "!" pops overhead.
 * READY : ~0.4s later it settles into a calm, smiling agent and the support
 *         headset drops onto the ears, the mic boom swings down and sound
 *         waves pulse — signalling "I'm here to help".
 * On mouse-leave / blur it goes back to sleep.
 *
 * Hidden on the support pages themselves to avoid redundancy.
 */
export function SupportFab() {
  const pathname = usePathname()
  const { user } = useSession()
  const { t, dir } = useI18n()
  const reducedMotion = useReducedMotion()
  const [phase, setPhase] = useState<Phase>("sleep")
  // Delay mount so the fade-in doesn't collide with page-load.
  const [mounted, setMounted] = useState(false)
  const shockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (shockTimer.current) clearTimeout(shockTimer.current)
    if (touchTimer.current) clearTimeout(touchTimer.current)
    shockTimer.current = null
    touchTimer.current = null
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 150)
    return () => clearTimeout(id)
  }, [])

  // Wake = startle first, then settle into "ready".
  const wake = useCallback(() => {
    clearTimers()
    if (reducedMotion) {
      setPhase("ready")
      return
    }
    setPhase("shock")
    shockTimer.current = setTimeout(() => setPhase("ready"), 420)
  }, [clearTimers, reducedMotion])

  const sleep = useCallback(() => {
    clearTimers()
    setPhase("sleep")
  }, [clearTimers])

  // Touch: run the full startle → ready, then auto-doze after a beat.
  const wakeTouch = useCallback(() => {
    clearTimers()
    if (reducedMotion) {
      setPhase("ready")
    } else {
      setPhase("shock")
      shockTimer.current = setTimeout(() => setPhase("ready"), 420)
    }
    touchTimer.current = setTimeout(() => setPhase("sleep"), 2800)
  }, [clearTimers, reducedMotion])

  useEffect(() => () => clearTimers(), [clearTimers])

  if (!user) return null
  if (pathname?.startsWith("/support")) return null

  const awake = phase !== "sleep"
  const shock = phase === "shock"
  const ready = phase === "ready"
  const dozing = phase === "sleep" && !reducedMotion

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 10 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed end-4 bottom-[calc(6rem+max(env(safe-area-inset-bottom),var(--tg-safe-bottom,0px)))] z-40 lg:bottom-6 lg:end-5"
      style={{ perspective: "700px" }}
      dir={dir}
    >
      <motion.div
        onMouseEnter={wake}
        onMouseLeave={sleep}
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") wake()
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") sleep()
        }}
        animate={awake && !reducedMotion ? { y: -4, rotateX: 8, scale: 1.05 } : { y: 0, rotateX: 0, scale: 1 }}
        whileTap={{ scale: 0.94, y: 3 }}
        transition={springWake}
        className="relative pb-2"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* stacked 3D depth plates */}
        <span aria-hidden="true" className="absolute inset-x-1 bottom-0 h-12 rounded-2xl border border-border bg-card shadow-lg" />
        <span aria-hidden="true" className="absolute inset-x-0.5 bottom-1 h-12 rounded-2xl border border-primary/30 bg-secondary" />

        {/* glow ring: slow breathing while dozing, bright + steady when awake */}
        <motion.span
          aria-hidden="true"
          animate={
            awake
              ? { opacity: 0.9, scale: shock ? 1.22 : 1.14 }
              : dozing
                ? { opacity: [0.22, 0.42, 0.22], scale: [0.92, 1.01, 0.92] }
                : { opacity: 0.35, scale: 1 }
          }
          transition={
            awake
              ? shock
                ? springShock
                : springSoft
              : { duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
          }
          className="absolute inset-0 bottom-2 rounded-2xl bg-primary/40 blur-md"
        />

        <Link
          href="/support"
          aria-label={t("a11y.supportOnline")}
          onFocus={wake}
          onBlur={sleep}
          onTouchStart={wakeTouch}
          className="group relative flex size-16 items-center justify-center overflow-hidden rounded-2xl border border-primary/50 bg-primary text-primary-foreground shadow-md outline-none transition-colors duration-300 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:size-14"
        >
          {/* sheen sweep on wake */}
          <motion.span
            aria-hidden="true"
            animate={awake && !reducedMotion ? { x: ["-160%", "160%"] } : { x: "-160%" }}
            transition={awake ? { duration: 0.9, ease: "easeOut" } : { duration: 0 }}
            className="absolute inset-y-0 w-1/2 -skew-x-12 bg-primary-foreground/20"
          />

          {/* Whole character. Geometry is centred on (24,24) so it sits dead-centre
              in the button. Dozing = gentle bob; shock = sharp upward jolt; ready = calm lift. */}
          <motion.svg
            viewBox="0 0 48 48"
            className="relative size-11 lg:size-10"
            fill="none"
            aria-hidden="true"
            animate={
              phase === "sleep"
                ? reducedMotion
                  ? { y: 0, rotate: 0, scale: 1 }
                  : { y: [0, 1.6, 0], rotate: [-1.5, 1.5, -1.5], scale: 1 }
                : phase === "shock"
                  ? { y: -3.5, rotate: 0, scale: 1.06 }
                  : { y: -1.5, rotate: 0, scale: 1 }
            }
            transition={phase === "sleep" ? dozeLoop : phase === "shock" ? springShock : springWake}
            style={{ transformOrigin: "center" }}
          >
            {/* ---- face (centred) ---- */}
            <circle cx="24" cy="24" r="10.5" stroke="currentColor" strokeWidth="2.2" />

            {/* closed (sleeping) eyes */}
            <motion.g
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              animate={{ opacity: awake ? 0 : 1 }}
              transition={{ duration: 0.25 }}
            >
              <path d="M17.8 23.4 Q19.8 25.3 21.8 23.4" />
              <path d="M26.2 23.4 Q28.2 25.3 30.2 23.4" />
            </motion.g>

            {/* open eyes — bulge wide on shock, settle to normal when ready */}
            <motion.circle
              cx="19.9"
              cy="23.2"
              r="1.8"
              fill="currentColor"
              animate={{ opacity: awake ? 1 : 0, scale: shock ? 2 : awake ? 1 : 0.2 }}
              transition={shock ? springShock : springWake}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
            <motion.circle
              cx="28.1"
              cy="23.2"
              r="1.8"
              fill="currentColor"
              animate={{ opacity: awake ? 1 : 0, scale: shock ? 2 : awake ? 1 : 0.2 }}
              transition={shock ? springShock : springWake}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />

            {/* sleepy sigh mouth */}
            <motion.path
              d="M22.4 29 Q24 30.2 25.6 29"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              animate={{ opacity: phase === "sleep" ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            />
            {/* surprised "o" mouth during the shock */}
            <motion.ellipse
              cx="24"
              cy="29.4"
              rx="1.7"
              ry="2.3"
              fill="currentColor"
              animate={{ opacity: shock ? 1 : 0, scale: shock ? 1 : 0.4 }}
              transition={shock ? springShock : { duration: 0.15 }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
            {/* bright smile once ready */}
            <motion.path
              d="M20.4 28.4 Q24 32.8 27.6 28.4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              animate={{ opacity: ready ? 1 : 0 }}
              transition={springSoft}
            />

            {/* startle mark — a bold "!" that pops overhead during shock */}
            <motion.text
              x="24"
              y="9"
              textAnchor="middle"
              fill="currentColor"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontWeight="900"
              fontSize="11"
              animate={shock ? { opacity: [0, 1, 1, 0], y: [11, 8, 8, 6], scale: [0.5, 1.2, 1, 1] } : { opacity: 0, scale: 0.5 }}
              transition={shock ? { duration: 0.5, ease: "easeOut" } : { duration: 0.15 }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              !
            </motion.text>

            {/* sleeping "z z z" — a trail that keeps rising above the head and fading.
                Animate the rise on a wrapping <g> (transform), NOT the text `y`
                attribute, so motion nudges the glyph upward instead of relocating it. */}
            <motion.g
              fill="currentColor"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontWeight="900"
              animate={{ opacity: phase === "sleep" ? 1 : 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* small z (closest to the head) */}
              <motion.g
                animate={
                  awake || reducedMotion
                    ? { opacity: awake ? 0 : 1, y: 0 }
                    : { opacity: [0, 1, 1, 0], y: [2, -2, -6, -9] }
                }
                transition={reducedMotion ? { duration: 0.2 } : { duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
              >
                <text x="28" y="13" fontSize="7">z</text>
              </motion.g>

              {/* medium z */}
              <motion.g
                animate={
                  awake || reducedMotion
                    ? { opacity: 0, y: 0 }
                    : { opacity: [0, 1, 1, 0], y: [2, -2, -6, -9] }
                }
                transition={reducedMotion ? { duration: 0.2 } : { duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeOut", delay: 1 }}
              >
                <text x="32" y="8" fontSize="8.5">z</text>
              </motion.g>

              {/* large z (furthest / highest) */}
              <motion.g
                animate={
                  awake || reducedMotion
                    ? { opacity: 0, y: 0 }
                    : { opacity: [0, 1, 1, 0], y: [2, -2, -6, -9] }
                }
                transition={reducedMotion ? { duration: 0.2 } : { duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeOut", delay: 2 }}
              >
                <text x="36.5" y="4" fontSize="10">z</text>
              </motion.g>
            </motion.g>

            {/* ---- headset: hidden while asleep / startled, drops onto the ears once READY ---- */}
            <motion.g
              animate={{ y: ready ? 0 : -10, rotate: ready ? 0 : -16, opacity: ready ? 1 : 0, scale: ready ? 1 : 0.85 }}
              transition={ready ? springWake : { duration: 0.2 }}
              style={{ transformBox: "fill-box", transformOrigin: "50% 15%" }}
            >
              {/* band over the top of the head */}
              <path d="M13 23.5 a11 11 0 0 1 22 0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              {/* ear cups */}
              <rect x="10.8" y="20" width="4.8" height="8.6" rx="2.4" fill="currentColor" />
              <rect x="32.4" y="20" width="4.8" height="8.6" rx="2.4" fill="currentColor" />
              {/* mic boom swings down once headset lands */}
              <motion.g
                animate={{ rotate: ready ? 0 : -95, opacity: ready ? 1 : 0 }}
                transition={ready ? { ...springWake, delay: 0.18 } : { duration: 0.2 }}
                style={{ transformBox: "view-box", transformOrigin: "34.8px 27px" }}
              >
                <path d="M34.8 27.5 Q34.8 33.8 29 34.3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
                <circle cx="28.6" cy="34.3" r="1.9" fill="currentColor" />
              </motion.g>
            </motion.g>

            {/* sound waves pulsing when ready */}
            <motion.g
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              animate={
                ready && !reducedMotion
                  ? { opacity: [0, 1, 0.4, 1], x: [0, -1.5, 0] }
                  : { opacity: ready ? 0.9 : 0 }
              }
              transition={
                ready && !reducedMotion
                  ? { duration: 1.4, repeat: Number.POSITIVE_INFINITY, delay: 0.4 }
                  : { duration: 0.25 }
              }
            >
              <path d="M7.5 21 a6.5 6.5 0 0 0 0 7" />
              <path d="M4.5 19 a10 10 0 0 0 0 11" opacity="0.55" />
            </motion.g>
          </motion.svg>

          <span className="sr-only">{t("a11y.supportOnline")}</span>
        </Link>
      </motion.div>
    </motion.div>
  )
}
