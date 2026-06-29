"use client"

import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react"
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
 *
 * The wrapper establishes a real 3D context (`preserve-3d`), so descendants can
 * pop toward the viewer with a `[transform:translateZ(...)]` utility for layered
 * depth. An optional glossy glare follows the pointer for a glassy, lit feel.
 */
export function Tilt({
  children,
  className,
  max = 8,
  glare = false,
  scale = 1.02,
}: {
  children: ReactNode
  className?: string
  max?: number
  glare?: boolean
  scale?: number
}) {
  const reduce = useReducedMotion()
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const sc = useMotionValue(1)
  const gx = useMotionValue(50)
  const gy = useMotionValue(50)
  const go = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 200, damping: 18 })
  const sry = useSpring(ry, { stiffness: 200, damping: 18 })
  const ssc = useSpring(sc, { stiffness: 220, damping: 20 })
  const glareBg = useTransform(
    [gx, gy] as const,
    ([x, y]: number[]) =>
      `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%)`,
  )

  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      style={{
        rotateX: srx,
        rotateY: sry,
        scale: ssc,
        transformPerspective: 900,
        transformStyle: "preserve-3d",
      }}
      onPointerMove={(e) => {
        if (e.pointerType === "touch") return
        const r = e.currentTarget.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        ry.set(px * max * 2)
        rx.set(-py * max * 2)
        sc.set(scale)
        gx.set((px + 0.5) * 100)
        gy.set((py + 0.5) * 100)
        go.set(1)
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
        sc.set(1)
        go.set(0)
      }}
    >
      {children}
      {glare ? (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] mix-blend-soft-light"
          style={{ background: glareBg, opacity: go }}
        />
      ) : null}
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

/**
 * Scroll-into-view reveal. Fades + rises (or scales) as the element enters the
 * viewport, giving sections a cinematic "settle" without overdoing it. Respects
 * reduced motion (renders statically) and only animates once by default.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  once = true,
  as = "div",
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  once?: boolean
  as?: "div" | "section" | "li" | "article"
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once, margin: "-12% 0px -12% 0px" })
  const MotionTag = motion[as] as typeof motion.div

  if (reduce) {
    const Tag = as
    return (
      <Tag ref={ref as never} className={className}>
        {children}
      </Tag>
    )
  }

  return (
    <MotionTag
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ type: "spring", stiffness: 220, damping: 30, delay }}
    >
      {children}
    </MotionTag>
  )
}

/**
 * Scroll-linked parallax. Translates its children on the Y axis as the page
 * scrolls past, for layered depth on hero art and feature imagery. `speed`
 * controls intensity (positive = moves slower than scroll). Disabled under
 * reduced motion.
 */
export function Parallax({
  children,
  className,
  speed = 40,
}: {
  children: ReactNode
  className?: string
  speed?: number
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed])

  if (reduce) return <div className={className}>{children}</div>

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  )
}

/**
 * Thin gradient progress bar pinned to the top of the viewport that tracks
 * page scroll. Tinted with the active theme accent. Hidden for reduced motion.
 */
export function ScrollProgress({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  })

  if (reduce) return null

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className={
        "fixed inset-x-0 top-0 z-[60] h-0.5 origin-[100%_50%] bg-gold " +
        (className ?? "")
      }
    />
  )
}
