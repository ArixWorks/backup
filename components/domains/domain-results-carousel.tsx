"use client"

import * as React from "react"
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  animate,
  type MotionValue,
  type PanInfo,
} from "motion/react"
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Globe, Loader2, WalletCards, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { DOMAIN_COPY } from "@/lib/i18n/domain-copy"

/** Availability buckets used to theme each card (green / red / neutral). */
export type DomainAvailability = "available" | "taken" | "review"

/** Normalized, presentation-ready domain result consumed by the carousel. */
export interface DomainResult {
  key: string
  ascii: string
  display: string
  tld: string
  availability: DomainAvailability
  price: string | null
  description: string
}

interface CarouselConfig {
  distanceDivisor: number
  velocityDivisor: number
  sensitivity: number
  xMultiplier: number
  yMultiplier: number
  rotationMultiplier: number
  scaleReduction: number
  maxBlur: number
  cardWidth: number
}

/** Card widths (px) — kept in sync with the CARD_SHELL Tailwind classes. */
const CARD_WIDTH_PHONE = 240 // w-[15rem]
const CARD_WIDTH_WIDE = 288 // sm:w-[18rem]

/**
 * Responsive drag/fan physics. The horizontal offset is derived from the *actual*
 * track width so the first side card always tucks under the center card and its
 * outer edge stays fully inside the viewport (never clipped by overflow-hidden).
 */
function getConfig(trackWidth: number, reduced: boolean): CarouselConfig {
  const w = trackWidth > 0 ? trackWidth : 360
  const isPhone = w < 640
  const isTablet = w >= 640 && w < 1024
  const cardWidth = isPhone ? CARD_WIDTH_PHONE : CARD_WIDTH_WIDE
  const scaleReduction = isPhone ? 0.13 : isTablet ? 0.11 : 0.1

  // Widest offset that keeps the first side card's outer edge inside the track.
  const firstSideHalf = (cardWidth * (1 - scaleReduction)) / 2
  const fitX = w / 2 - firstSideHalf - 10
  const baseX = isPhone ? 82 : isTablet ? 132 : 172
  const xMultiplier = Math.max(34, Math.min(baseX, fitX))

  return {
    cardWidth,
    scaleReduction,
    xMultiplier,
    yMultiplier: reduced ? 0 : isPhone ? 26 : 34,
    rotationMultiplier: reduced ? 0 : isPhone ? 7 : 10,
    maxBlur: isPhone ? 4 : 5,
    distanceDivisor: isPhone ? 110 : isTablet ? 150 : 190,
    velocityDivisor: isPhone ? 480 : isTablet ? 620 : 780,
    sensitivity: isPhone ? 170 : isTablet ? 210 : 240,
  }
}

/** Measures an element's content width and keeps it in sync via ResizeObserver. */
function useMeasuredWidth() {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

type DomainCopy = (typeof DOMAIN_COPY)["fa"]

interface CarouselProps {
  items: DomainResult[]
  copy: DomainCopy
  money: (value: string | number) => string
  onPurchase: (item: DomainResult) => void
  purchasingKey: string | null
  disabled: boolean
  /** When true, render a neutral fanned skeleton with a spinner in each card. */
  loading?: boolean
  /** How many placeholder cards to fan while loading. */
  loadingCount?: number
}

export function DomainResultsCarousel({ items, copy, money, onPurchase, purchasingKey, disabled, loading = false, loadingCount = 7 }: CarouselProps) {
  const reduced = useReducedMotion() ?? false
  const scrollProgress = useMotionValue(0)
  const startProgress = React.useRef(0)
  const [trackRef, trackWidth] = useMeasuredWidth()
  const [activeIndex, setActiveIndex] = React.useState(0)
  const total = items.length

  // Reset to the first card whenever a fresh result set arrives.
  React.useEffect(() => {
    scrollProgress.set(0)
    setActiveIndex(0)
  }, [items, scrollProgress])

  const config = React.useMemo(() => getConfig(trackWidth, reduced), [trackWidth, reduced])

  useMotionValueEvent(scrollProgress, "change", (value) => {
    if (total === 0) return
    const next = ((Math.round(value) % total) + total) % total
    setActiveIndex((current) => (current === next ? current : next))
  })

  const goTo = React.useCallback(
    (targetIndex: number) => {
      const current = scrollProgress.get()
      const currentMod = ((Math.round(current) % total) + total) % total
      let diff = targetIndex - currentMod
      if (diff > total / 2) diff -= total
      if (diff < -total / 2) diff += total
      animate(scrollProgress, Math.round(current) + diff, { type: "spring", stiffness: 220, damping: 30, mass: 1 })
    },
    [scrollProgress, total],
  )

  const step = React.useCallback(
    (delta: number) => {
      const current = Math.round(scrollProgress.get())
      animate(scrollProgress, current + delta, { type: "spring", stiffness: 220, damping: 30, mass: 1 })
    },
    [scrollProgress],
  )

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const distanceShift = -info.offset.x / config.distanceDivisor
    const velocityShift = -info.velocity.x / config.velocityDivisor
    let totalShift = Math.round(distanceShift + velocityShift)
    totalShift = Math.max(-3, Math.min(3, totalShift))
    const target = Math.round(startProgress.current) + totalShift
    animate(scrollProgress, target, { type: "spring", stiffness: 200, damping: 30, mass: 1 })
  }

  // ---- Loading skeleton: same fan, neutral theme, a spinner in every card ----
  if (loading) {
    // `isolate` contains the inner z-index scale so fixed nav / FAB stay on top.
    return (
      <div className="isolate flex w-full flex-col items-center gap-5 select-none">
        <LoadingFan count={loadingCount} reduced={reduced} label={copy.searching} />
      </div>
    )
  }

  const activeItem = items[activeIndex]
  const glowClass =
    activeItem?.availability === "available"
      ? "bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--chart-2)_45%,transparent),transparent_70%)]"
      : activeItem?.availability === "taken"
        ? "bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--destructive)_38%,transparent),transparent_70%)]"
        : "bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_30%,transparent),transparent_70%)]"

  return (
    // `isolate` creates a local stacking context so the cards' inline z-index
    // (up to 100) never paints above the fixed bottom nav (z-50) or support FAB (z-40).
    <div className="isolate flex w-full flex-col items-center gap-5 select-none">
      <div
        ref={trackRef}
        className="relative flex h-[26rem] w-full items-center justify-center overflow-hidden sm:h-[30rem]"
        role="group"
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); step(-1) }
          if (event.key === "ArrowRight") { event.preventDefault(); step(1) }
        }}
      >
        {/* Availability-tinted ambient glow behind the stack */}
        <div aria-hidden className={cn("pointer-events-none absolute h-72 w-72 rounded-full opacity-70 blur-3xl transition-colors duration-700 sm:h-96 sm:w-96", glowClass)} />

        {/* Transparent drag surface — cards are pointer-events-none so drags fall through to here */}
        {total > 1 && (
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragStart={() => { startProgress.current = scrollProgress.get() }}
            onDrag={(_, info) => scrollProgress.set(scrollProgress.get() + -info.delta.x / config.sensitivity)}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
          />
        )}

        {items.map((item, index) => (
          <DomainCard
            key={item.key}
            item={item}
            index={index}
            total={total}
            progress={scrollProgress}
            config={config}
            isActive={index === activeIndex}
            copy={copy}
            money={money}
            onPurchase={onPurchase}
            purchasing={purchasingKey === item.key}
            disabled={disabled}
          />
        ))}
      </div>

      {total > 1 && (
        // Force LTR so the physical-left button is the "previous" chevron and the
        // physical-right button is the "next" chevron in every locale.
        <div dir="ltr" className="z-30 flex items-center gap-4">
          <Button type="button" size="icon" variant="outline" className="size-11 rounded-full" onClick={() => step(-1)} aria-label={copy.prevAria}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="flex items-center gap-2" role="tablist" aria-label={copy.resultsTitle}>
            {items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`${copy.goToAria} ${item.display}`}
                onClick={() => goTo(index)}
                className={cn(
                  "h-2.5 rounded-full transition-all duration-300",
                  index === activeIndex
                    ? item.availability === "available"
                      ? "w-7 bg-chart-2"
                      : item.availability === "taken"
                        ? "w-7 bg-destructive"
                        : "w-7 bg-primary"
                    : "w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                )}
              />
            ))}
          </div>
          <Button type="button" size="icon" variant="outline" className="size-11 rounded-full" onClick={() => step(1)} aria-label={copy.nextAria}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      )}
    </div>
  )
}

/** Shared fan card shell — geometry/animation identical for real and loading cards. */
const CARD_SHELL = "pointer-events-none absolute h-[24rem] w-[15rem] overflow-hidden rounded-[1.75rem] border shadow-2xl backdrop-blur-xl sm:h-[27rem] sm:w-[18rem]"

interface CardProps {
  item: DomainResult
  index: number
  total: number
  progress: MotionValue<number>
  config: CarouselConfig
  isActive: boolean
  copy: DomainCopy
  money: (value: string | number) => string
  onPurchase: (item: DomainResult) => void
  purchasing: boolean
  disabled: boolean
}

/** Fan transforms shared by real and placeholder cards. */
function useFanTransforms(progress: MotionValue<number>, index: number, total: number, config: CarouselConfig) {
  const offset = useTransform(progress, (p) => {
    let diff = (index - p) % total
    if (diff > total / 2) diff -= total
    if (diff < -total / 2) diff += total
    return diff
  })
  const x = useTransform(offset, (o) => o * config.xMultiplier)
  const rotate = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 0 : o * config.rotationMultiplier))
  const y = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 0 : Math.abs(o) * config.yMultiplier))
  const scale = useTransform(offset, (o) => 1 - Math.abs(o) * config.scaleReduction)
  const opacity = useTransform(offset, [-total / 2, -total / 2 + 0.6, 0, total / 2 - 0.6, total / 2], [0, 1, 1, 1, 0])
  const zIndex = useTransform(offset, (o) => Math.round(100 - Math.abs(o) * 10))
  // Side cards stay visible but softly blurred (~50%) and dimmed so their text
  // does not compete with the focused card in the center.
  const contentBlur = useTransform(offset, (o) => `blur(${Math.min(Math.abs(o) * config.maxBlur, config.maxBlur).toFixed(2)}px)`)
  const contentOpacity = useTransform(offset, (o) => (Math.abs(o) < 0.05 ? 1 : 0.6))
  return { offset, x, y, rotate, scale, opacity, zIndex, contentBlur, contentOpacity }
}

function DomainCard({ item, index, total, progress, config, isActive, copy, money, onPurchase, purchasing, disabled }: CardProps) {
  const { x, y, rotate, scale, opacity, zIndex, contentBlur, contentOpacity } = useFanTransforms(progress, index, total, config)

  const available = item.availability === "available"
  const taken = item.availability === "taken"

  const theme = available
    ? { ring: "border-chart-2/55", surface: "from-chart-2/22 via-card/85 to-card", glow: "bg-chart-2/25", chip: "border-chart-2/40 bg-chart-2/12 text-chart-2", badge: "bg-chart-2 text-background", icon: "text-chart-2" }
    : taken
      ? { ring: "border-destructive/50", surface: "from-destructive/22 via-card/85 to-card", glow: "bg-destructive/25", chip: "border-destructive/40 bg-destructive/12 text-destructive", badge: "bg-destructive text-destructive-foreground", icon: "text-destructive" }
      : { ring: "border-border/70", surface: "from-primary/14 via-card/85 to-card", glow: "bg-primary/20", chip: "border-border bg-muted/40 text-muted-foreground", badge: "bg-muted text-foreground", icon: "text-muted-foreground" }

  const StatusIcon = available ? CheckCircle2 : taken ? XCircle : Clock3
  const statusLabel = available ? copy.available : taken ? copy.taken : copy.needsReview

  // Split the formatted price into the numeric value and its currency word so
  // "تومان"/"USD" can render smaller beneath large amounts without wrapping.
  const priceStr = available && item.price ? money(item.price) : ""
  const currencyMatch = priceStr.match(/\s+([\u0600-\u06FFA-Za-z]+)$/)
  const priceValue = currencyMatch ? priceStr.slice(0, currencyMatch.index).trim() : priceStr
  const priceSuffix = currencyMatch ? currencyMatch[1] : ""

  return (
    <motion.div style={{ x, y, rotate, scale, opacity, zIndex }} className={cn(CARD_SHELL, theme.ring)}>
      {/* Liquid-glass themed surface */}
      <div className={cn("absolute inset-0 bg-gradient-to-b", theme.surface)} />
      <div aria-hidden className={cn("absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-70 blur-3xl", theme.glow)} />
      <div aria-hidden className="absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/10" />

      <motion.div style={{ opacity: contentOpacity, filter: contentBlur }} className="relative flex h-full flex-col p-5">
        <div className="flex items-center justify-between">
          <span className={cn("rounded-full border px-3 py-1 font-mono text-sm font-bold", theme.chip)} dir="ltr">
            {item.tld}
          </span>
          <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", theme.badge)}>
            <StatusIcon className="size-3.5" />
            {statusLabel}
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
          <span className={cn("flex size-16 items-center justify-center rounded-2xl border bg-background/40 backdrop-blur-md", theme.ring, theme.icon)}>
            <Globe className="size-8" />
          </span>
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <p dir="ltr" className="text-balance text-2xl font-black leading-tight tracking-tight text-foreground">
                {item.display}
              </p>
              {available ? <span className="text-xs font-medium text-muted-foreground">{copy.oneYear}</span> : null}
            </div>
            <p className="line-clamp-3 text-pretty text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {available && item.price ? (
            <div className="flex items-baseline justify-center gap-1.5">
              <strong dir="ltr" className="text-2xl font-black text-foreground">{priceValue}</strong>
              {priceSuffix ? <span className="text-xs font-medium text-muted-foreground">{priceSuffix}</span> : null}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">{taken ? copy.alreadyRegistered : copy.retry}</p>
          )}

          {available ? (
            <Button
              className={cn("h-11 w-full rounded-2xl text-base shadow-lg shadow-chart-2/20", isActive ? "pointer-events-auto" : "pointer-events-none")}
              onClick={() => onPurchase(item)}
              disabled={disabled || purchasing}
              tabIndex={isActive ? 0 : -1}
              aria-hidden={!isActive}
            >
              {purchasing ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <WalletCards data-icon="inline-start" />}
              {purchasing ? copy.ordering : copy.buy}
            </Button>
          ) : (
            <Button className="h-11 w-full rounded-2xl" variant="outline" disabled aria-hidden={!isActive} tabIndex={-1}>
              {taken ? copy.cannotBuy : copy.unknown}
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

/** Neutral fanned skeleton shown while suggestions are being generated. */
function LoadingFan({ count, reduced, label }: { count: number; reduced: boolean; label: string }) {
  // Center the fan on the middle card so it mirrors the real result layout.
  const progress = useMotionValue(Math.floor(count / 2))
  const [trackRef, trackWidth] = useMeasuredWidth()
  const config = React.useMemo(() => getConfig(trackWidth, reduced), [trackWidth, reduced])
  return (
    <div ref={trackRef} className="relative flex h-[26rem] w-full items-center justify-center overflow-hidden sm:h-[30rem]" role="status" aria-label={label} aria-live="polite">
      <div aria-hidden className="pointer-events-none absolute h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_70%)] opacity-70 blur-3xl sm:h-96 sm:w-96" />
      {Array.from({ length: count }).map((_, index) => (
        <LoadingCard key={index} index={index} total={count} progress={progress} config={config} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

function LoadingCard({ index, total, progress, config }: { index: number; total: number; progress: MotionValue<number>; config: CarouselConfig }) {
  const { x, y, rotate, scale, opacity, zIndex } = useFanTransforms(progress, index, total, config)
  return (
    <motion.div style={{ x, y, rotate, scale, opacity, zIndex }} className={cn(CARD_SHELL, "border-border/70")}>
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-card/85 to-card" />
      <div aria-hidden className="absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/15 opacity-70 blur-3xl" />
      <div aria-hidden className="absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/10" />
      <div className="relative flex h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary/70" />
      </div>
    </motion.div>
  )
}
