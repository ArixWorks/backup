"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"

const springSnap = { type: "spring", stiffness: 640, damping: 22, mass: 0.6 } as const
const springSoft = { type: "spring", stiffness: 320, damping: 24 } as const

/**
 * Always-available customer-support entry point. Icon-only 3D floating action
 * button with a living "support agent" character: while idle the agent dozes
 * (closed eyes, floating headset, drifting z's). On hover / touch / focus the
 * headset snaps onto the ears, the mic boom swings down, the eyes pop open and
 * sound waves pulse — the agent is awake and ready to answer.
 * Hidden on the support pages themselves to avoid redundancy.
 */
export function SupportFab() {
  const pathname = usePathname()
  const { user } = useSession()
  const { t, dir } = useI18n()
  const reducedMotion = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const wake = useCallback(() => {
    if (touchTimer.current) clearTimeout(touchTimer.current)
    setHovered(true)
  }, [])
  const sleep = useCallback(() => setHovered(false), [])
  const wakeTouch = useCallback(() => {
    if (touchTimer.current) clearTimeout(touchTimer.current)
    setHovered(true)
    touchTimer.current = setTimeout(() => setHovered(false), 1400)
  }, [])

  if (!user) return null
  if (pathname?.startsWith("/support")) return null

  // With reduced motion the agent is simply always awake and static.
  const awake = reducedMotion ? true : hovered

  return (
    <AnimatePresence>
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.78, y: 12, rotate: dir === "rtl" ? -8 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.82, y: 8 }}
        transition={springSoft}
        className="fixed end-4 bottom-[calc(6rem+max(env(safe-area-inset-bottom),var(--tg-safe-bottom,0px)))] z-40 lg:bottom-6 lg:end-5"
        style={{ perspective: "600px" }}
        dir={dir}
      >
        <motion.div
          onHoverStart={wake}
          onHoverEnd={sleep}
          whileHover={reducedMotion ? undefined : { y: -3, rotateX: 6 }}
          whileTap={reducedMotion ? { scale: 0.96 } : { y: 5, rotateX: -7, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 520, damping: 24 }}
          className="relative pb-2"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* stacked 3D depth plates */}
          <span aria-hidden="true" className="absolute inset-x-1 bottom-0 h-12 rounded-2xl border border-border bg-card shadow-lg" />
          <span aria-hidden="true" className="absolute inset-x-0.5 bottom-1 h-12 rounded-2xl border border-primary/30 bg-secondary" />

          {/* soft glow when awake */}
          <motion.span
            aria-hidden="true"
            animate={{ opacity: awake ? 1 : 0, scale: awake ? 1.12 : 0.9 }}
            transition={springSoft}
            className="absolute inset-0 bottom-2 rounded-2xl bg-primary/45 blur-md"
          />

          <Link
            href="/support"
            aria-label={t("a11y.supportOnline")}
            onFocus={wake}
            onBlur={sleep}
            onTouchStart={wakeTouch}
            className="group relative flex size-16 items-center justify-center overflow-hidden rounded-2xl border border-primary/50 bg-primary text-primary-foreground shadow-md outline-none transition-colors duration-300 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:size-14"
          >
            {/* top bevel highlight */}
            <span aria-hidden="true" className="absolute inset-x-2 top-1 h-px bg-primary-foreground/40" />
            {/* sheen sweep on wake */}
            <motion.span
              aria-hidden="true"
              animate={awake && !reducedMotion ? { x: ["-150%", "150%"] } : { x: "-150%" }}
              transition={awake ? { duration: 0.7, ease: "easeOut" } : { duration: 0 }}
              className="absolute inset-y-0 w-1/2 -skew-x-12 bg-primary-foreground/15"
            />

            <svg viewBox="0 0 48 48" className="relative size-11 lg:size-10" fill="none" aria-hidden="true">
              {/* ---- face ---- */}
              <circle cx="24" cy="28" r="10.5" stroke="currentColor" strokeWidth="2.2" />

              {/* closed (sleeping) eyes */}
              <motion.g
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                animate={{ opacity: awake ? 0 : 1 }}
                transition={{ duration: 0.12 }}
              >
                <path d="M17.8 27.5 Q19.8 29.4 21.8 27.5" />
                <path d="M26.2 27.5 Q28.2 29.4 30.2 27.5" />
              </motion.g>

              {/* open (awake) eyes */}
              <motion.g
                fill="currentColor"
                animate={{ opacity: awake ? 1 : 0, scale: awake ? 1 : 0.4 }}
                transition={springSnap}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              >
                <circle cx="19.8" cy="27.3" r="1.7" />
                <circle cx="28.2" cy="27.3" r="1.7" />
              </motion.g>

              {/* mouth: tiny sigh -> bright open smile */}
              <motion.path
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                animate={{ d: awake ? "M20.8 32.2 Q24 36 27.2 32.2" : "M22.4 33 Q24 34.2 25.6 33" }}
                transition={springSoft}
              />

              {/* drifting z z z while asleep */}
              {!reducedMotion && (
                <motion.g
                  fill="currentColor"
                  className="font-sans"
                  animate={{ opacity: awake ? 0 : 1 }}
                  transition={{ duration: 0.1 }}
                >
                  <motion.text
                    x="34"
                    y="13"
                    fontSize="7"
                    fontWeight="800"
                    animate={awake ? {} : { opacity: [0, 1, 0], y: [15, 10, 6] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  >
                    z
                  </motion.text>
                  <motion.text
                    x="39"
                    y="9"
                    fontSize="5"
                    fontWeight="800"
                    animate={awake ? {} : { opacity: [0, 1, 0], y: [11, 6, 2] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 0.5 }}
                  >
                    z
                  </motion.text>
                </motion.g>
              )}

              {/* ---- headset: floats above while asleep, snaps onto ears on wake ---- */}
              <motion.g
                animate={{ y: awake ? 0 : -8, rotate: awake ? 0 : -12, opacity: awake ? 1 : 0.55 }}
                transition={springSnap}
                style={{ transformBox: "fill-box", transformOrigin: "50% 20%" }}
              >
                {/* band */}
                <path d="M13 27.5 a11 11 0 0 1 22 0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                {/* ear cups */}
                <rect x="10.8" y="24" width="4.8" height="8.6" rx="2.4" fill="currentColor" />
                <rect x="32.4" y="24" width="4.8" height="8.6" rx="2.4" fill="currentColor" />
                {/* mic boom swings down once headset lands */}
                <motion.g
                  animate={{ rotate: awake ? 0 : -95, opacity: awake ? 1 : 0 }}
                  transition={awake ? { ...springSnap, delay: 0.1 } : { duration: 0.15 }}
                  style={{ transformBox: "view-box", transformOrigin: "34.8px 31px" }}
                >
                  <path d="M34.8 31.5 Q34.8 37.8 29 38.3" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
                  <circle cx="28.6" cy="38.3" r="1.9" fill="currentColor" />
                </motion.g>
              </motion.g>

              {/* sound waves pulsing when ready */}
              <motion.g
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                animate={
                  awake && !reducedMotion
                    ? { opacity: [0, 1, 0.4, 1], x: [0, -1.5, 0] }
                    : { opacity: awake ? 0.9 : 0 }
                }
                transition={awake && !reducedMotion ? { duration: 1.1, repeat: Number.POSITIVE_INFINITY, delay: 0.25 } : { duration: 0.15 }}
              >
                <path d="M7.5 25 a6.5 6.5 0 0 0 0 7" />
                <path d="M4.5 23 a10 10 0 0 0 0 11" opacity="0.55" />
              </motion.g>
            </svg>

            <span className="sr-only">{t("a11y.supportOnline")}</span>
          </Link>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
