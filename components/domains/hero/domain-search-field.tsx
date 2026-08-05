"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useAnimate, useMotionTemplate, useMotionValue } from "motion/react"
import { CheckCircle2, Globe2, Loader2, Search, XCircle } from "lucide-react"
import { useMotionTier } from "@/components/motion-provider"
import { cn } from "@/lib/utils"

/** Live verdict on the extension the user typed, computed by the parent. */
export type ExtensionState = "none" | "supported" | "unsupported"

/**
 * What the field is currently showing. `checking` is the debounce window: the
 * spinner is live while the user is still typing and for a short settle period
 * after, so the price never flickers mid-word.
 */
type Phase = "idle" | "checking" | "priced" | "invalid"

/** Radius of the pointer-tracked halo, in px. */
const GLOW_RADIUS = 210
/** Quiet period after the last keystroke before the price is revealed. */
const SETTLE_MS = 700

interface DomainSearchFieldProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  extState: ExtensionState
  /** Pre-formatted price for the matched extension, or null when unknown. */
  priceLabel: string | null
  /** Normalized domain. A change here restarts the settle window. */
  domain: string
  /** A lookup/generation request is in flight. */
  busy: boolean
  inputId?: string
  describedBy?: string
  labels: {
    placeholder: string
    aria: string
    search: string
    checkingPrice: string
    unsupported: string
  }
}

/**
 * The hero domain search box: a pill with a pointer-tracked halo, a spinner that
 * resolves into the extension's price, and a shake + red bloom when the typed
 * extension isn't one we sell.
 */
export function DomainSearchField({
  value,
  onChange,
  onSubmit,
  extState,
  priceLabel,
  domain,
  busy,
  inputId = "domain-search-input",
  describedBy,
  labels,
}: DomainSearchFieldProps) {
  const tier = useMotionTier()
  // Gate on the resolved tier, never the raw media query, so an explicit
  // "cinematic" pick still animates and "minimal" stays completely still.
  const animated = tier !== "minimal"

  const shellRef = useRef<HTMLDivElement | null>(null)
  const [scope, animateShake] = useAnimate()
  const [focused, setFocused] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")

  // Pointer halo. Motion values are written directly to the compositor, so
  // tracking the cursor never re-renders this subtree on mousemove.
  const glowX = useMotionValue(-GLOW_RADIUS)
  const glowY = useMotionValue(-GLOW_RADIUS)
  const glowSize = useMotionValue(0)
  const glow = useMotionTemplate`radial-gradient(${glowSize}px circle at ${glowX}px ${glowY}px, var(--halo), transparent 70%)`

  /**
   * Drive the phase machine. Keyed on `domain` as well as the verdict so every
   * edit re-arms the spinner: the user sees it settle on the price only once
   * they stop typing.
   */
  useEffect(() => {
    if (extState === "unsupported") {
      setPhase("invalid")
      return
    }
    if (extState !== "supported" || !priceLabel) {
      setPhase("idle")
      return
    }
    setPhase("checking")
    const timer = setTimeout(() => setPhase("priced"), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [extState, priceLabel, domain])

  // One shake on entering the invalid state - not on every subsequent keystroke,
  // which would rattle the box while the user is still typing.
  useEffect(() => {
    if (phase !== "invalid" || !animated || !scope.current) return
    void animateShake(scope.current, { x: [0, -9, 8, -6, 4, 0] }, { duration: 0.45, ease: "easeOut" })
  }, [phase, animated, animateShake, scope])

  const halo =
    phase === "invalid"
      ? "var(--destructive)"
      : phase === "priced"
        ? "var(--chart-2)"
        : "var(--primary)"

  function trackPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!animated || !shellRef.current) return
    const { left, top } = shellRef.current.getBoundingClientRect()
    glowX.set(event.clientX - left)
    glowY.set(event.clientY - top)
  }

  // `min-w-0` runs all the way down the wrapper chain below: these are
  // flex/grid children whose default `min-width: auto` floors them at the pill's
  // max-content width, so on a narrow phone the field overflowed its grid track
  // and the hero card's `overflow-hidden` clipped the search button off-screen.
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <motion.div ref={scope} className="relative w-full min-w-0">
        {/* Bloom sitting behind the pill. Blurred and non-interactive, it reads
            as the box itself glowing rather than as a visible ring. */}
        <AnimatePresence>
          {(phase === "invalid" || phase === "priced" || focused) && animated ? (
            <motion.div
              key={phase === "invalid" ? "bloom-bad" : phase === "priced" ? "bloom-good" : "bloom-focus"}
              aria-hidden
              initial={{ opacity: 0, scale: 0.94 }}
              animate={
                phase === "invalid"
                  ? { opacity: [0.55, 0.28, 0.55], scale: 1 }
                  : { opacity: phase === "priced" ? 0.4 : 0.28, scale: 1 }
              }
              exit={{ opacity: 0, scale: 0.94 }}
              transition={
                phase === "invalid"
                  ? { opacity: { duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }, scale: { duration: 0.3 } }
                  : { duration: 0.4, ease: "easeOut" }
              }
              className={cn(
                "pointer-events-none absolute -inset-3 rounded-full blur-2xl",
                phase === "invalid" ? "bg-destructive/50" : phase === "priced" ? "bg-chart-2/40" : "bg-primary/40",
              )}
            />
          ) : null}
        </AnimatePresence>

        {/* Gradient border. A 1px padded wrapper whose child is opaque, so the
            halo only ever shows through as a hairline edge. */}
        <div
          ref={shellRef}
          onPointerMove={trackPointer}
          onPointerEnter={(event) => {
            trackPointer(event)
            if (animated) glowSize.set(GLOW_RADIUS)
          }}
          onPointerLeave={() => glowSize.set(0)}
          className="group relative rounded-full p-px"
          style={{ ["--halo" as string]: halo }}
        >
          <motion.div aria-hidden className="absolute inset-0 rounded-full" style={{ background: glow }} />

          {/* Static edge so the border is visible before the pointer arrives and
              on touch devices, which never fire a hover. */}
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full border transition-colors duration-300",
              phase === "invalid"
                ? "border-destructive/70"
                : phase === "priced"
                  ? "border-chart-2/60"
                  : focused
                    ? "border-primary/60"
                    : "border-border/70",
            )}
          />

          <div
            className={cn(
              "relative flex h-16 items-center gap-1 rounded-full bg-card/80 pe-2 ps-2 shadow-inner backdrop-blur-xl transition-colors duration-300",
              phase === "invalid" && "bg-destructive/[0.06]",
            )}
          >
            {/* Status slot. Morphs globe -> spinner -> price -> error, and sits
                on the inline-end edge (right in RTL) as in the design. */}
            <div className="relative flex h-10 min-w-10 shrink-0 items-center justify-center">
              <AnimatePresence mode="wait" initial={false}>
                {phase === "checking" ? (
                  <motion.span
                    key="checking"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2 px-1"
                    role="status"
                    aria-label={labels.checkingPrice}
                  >
                    <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
                  </motion.span>
                ) : phase === "priced" && priceLabel ? (
                  <motion.span
                    key="priced"
                    dir="ltr"
                    initial={{ opacity: 0, scale: 0.7, filter: "blur(4px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ type: "spring", stiffness: 420, damping: 26 }}
                    className="flex items-center gap-1.5 whitespace-nowrap px-2 text-sm font-bold text-chart-2"
                  >
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                    {priceLabel}
                  </motion.span>
                ) : phase === "invalid" ? (
                  <motion.span
                    key="invalid"
                    initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="px-1"
                  >
                    <XCircle className="size-5 text-destructive" aria-hidden />
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.18 }}
                    className="px-1"
                  >
                    <Globe2 className="size-5 text-muted-foreground" aria-hidden />
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <input
              id={inputId}
              dir="auto"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(event) => {
                // `isComposing` / keyCode 229 guard the CJK IME confirm key,
                // which otherwise submits a half-composed query.
                if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return
                onSubmit()
              }}
              placeholder={labels.placeholder}
              aria-label={labels.aria}
              aria-invalid={phase === "invalid"}
              aria-describedby={describedBy}
              autoComplete="off"
              spellCheck={false}
              className="h-12 min-w-0 flex-1 bg-transparent px-1 text-base text-foreground outline-none placeholder:text-muted-foreground/70"
            />

            <motion.button
              type="button"
              onClick={onSubmit}
              disabled={busy || phase === "invalid"}
              aria-label={labels.search}
              whileTap={animated ? { scale: 0.92 } : undefined}
              className={cn(
                "relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-opacity",
                "disabled:cursor-not-allowed disabled:opacity-45",
              )}
            >
              {/* Sheen sweep on hover, clipped by the circle. */}
              {animated ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary-foreground/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
              ) : null}
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Search className="size-5" aria-hidden />}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
