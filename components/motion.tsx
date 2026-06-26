"use client"

import { motion, useInView, useMotionValue, useSpring, useReducedMotion } from "motion/react"
import { useEffect, useRef, type ReactNode } from "react"

/**
 * Staggered container — children using <FadeItem> reveal one after another.
 */
export function Stagger({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.07, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** A single fade + rise item, meant to live inside <Stagger>. */
export function FadeItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: {
          opacity: 1,
          y: 0,
          transition: { type: "spring", stiffness: 260, damping: 26 },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Press / tap feedback wrapper for interactive cards & buttons. */
export function Pressable({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Cinematic 3D tilt that follows the pointer — premium hover feedback for
 * feature cards on desktop. No-ops on touch devices and when the user prefers
 * reduced motion, so the mobile Telegram experience stays flat and snappy.
 */
export function Tilt({
  children,
  className,
  max = 8,
}: {
  children: ReactNode
  className?: string
  max?: number
}) {
  const reduce = useReducedMotion()
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 200, damping: 18 })
  const sry = useSpring(ry, { stiffness: 200, damping: 18 })

  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType === "touch") return
        const r = e.currentTarget.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        ry.set(px * max * 2)
        rx.set(-py * max * 2)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Animated number that counts up to `value` (Persian digits, grouped) when it
 * scrolls into view. Falls back to the final value if motion is reduced.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const reduce = useReducedMotion()
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { stiffness: 60, damping: 18, mass: 0.8 })

  useEffect(() => {
    if (reduce) return
    if (inView) mv.set(value)
  }, [inView, value, mv, reduce])

  useEffect(() => {
    if (reduce) {
      if (ref.current) ref.current.textContent = format(value)
      return
    }
    const unsub = spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = format(Math.round(v))
    })
    return () => unsub()
  }, [spring, reduce, value])

  return <span ref={ref} className={className}>{format(reduce ? value : 0)}</span>
}

function format(n: number) {
  return new Intl.NumberFormat("fa-IR").format(n)
}
