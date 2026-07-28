"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import { motion } from "motion/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type PaymentCarouselItem = {
  id: string
  title: string
  subtitle?: string
  /** Path to a 3D image icon (png/svg). Takes priority over `iconNode`. */
  iconSrc?: string
  /** Fallback node icon (e.g. a lucide icon) when no image is provided. */
  iconNode?: ReactNode
  /** Optional highlighted text shown under the title (e.g. wallet balance). */
  meta?: string
  disabled?: boolean
  disabledHint?: string
}

/**
 * A coverflow-style rotating payment picker inspired by premium wallet UIs:
 * a large glossy icon tile sits in the center while neighbours rotate back in
 * 3D and dim. The active item's label renders below the track, with round
 * prev/next arrows. Users can swipe/drag, tap a side tile, or use the arrows.
 * Fully controlled via `activeIndex` + `onActiveChange`; tapping the centered
 * tile fires `onSelect` so the parent can advance the flow.
 */
export function PaymentMethodCarousel({
  items,
  activeIndex,
  onActiveChange,
  onSelect,
}: {
  items: PaymentCarouselItem[]
  activeIndex: number
  onActiveChange: (index: number) => void
  onSelect?: (index: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [drag, setDrag] = useState(0)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const spacing = Math.max(112, width * 0.4)
  const dragFraction = spacing > 0 ? drag / spacing : 0
  const active = items[Math.min(activeIndex, items.length - 1)]

  function commitDrag(offsetX: number, velocityX: number) {
    setDrag(0)
    // Positive drag (finger moves right) reveals the previous card.
    if (offsetX > 45 || velocityX > 400) onActiveChange(clamp(activeIndex - 1, items.length))
    else if (offsetX < -45 || velocityX < -400) onActiveChange(clamp(activeIndex + 1, items.length))
  }

  const subtitle = active?.disabled && active?.disabledHint ? active.disabledHint : active?.subtitle

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={containerRef} className="relative h-40 w-full [perspective:1000px]">
        <motion.div
          className="absolute inset-0 [transform-style:preserve-3d]"
          style={{ touchAction: "pan-y" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.16}
          onDrag={(_, info) => setDrag(info.offset.x)}
          onDragEnd={(_, info) => commitDrag(info.offset.x, info.velocity.x)}
        >
          {items.map((item, index) => {
            const pos = index - activeIndex - dragFraction
            const abs = Math.abs(pos)
            const isActive = index === activeIndex
            const hidden = abs > 2.2
            return (
              <button
                key={item.id}
                type="button"
                aria-hidden={hidden}
                tabIndex={hidden ? -1 : 0}
                aria-current={isActive}
                aria-label={item.title}
                onClick={() => {
                  if (Math.abs(drag) > 6) return
                  if (isActive) onSelect?.(index)
                  else onActiveChange(index)
                }}
                className={cn(
                  "absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 will-change-transform focus:outline-none",
                  drag === 0 && "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                )}
                style={{
                  transform: `translate(-50%, -50%) translateX(${pos * spacing}px) rotateY(${clampNum(-pos * 35, -46, 46)}deg) scale(${Math.max(0.6, 1 - abs * 0.28)})`,
                  opacity: hidden ? 0 : Math.max(0, 1 - abs * 0.45),
                  zIndex: 100 - Math.round(abs * 10),
                  pointerEvents: hidden ? "none" : "auto",
                }}
              >
                <IconTile item={item} active={isActive} />
              </button>
            )
          })}
        </motion.div>
      </div>

      {active && (
        <div className="flex min-h-12 flex-col items-center gap-0.5 text-center">
          <span className="text-lg font-black text-foreground">{active.title}</span>
          {active.meta ? (
            <span className="text-sm font-semibold tabular-nums text-primary">{active.meta}</span>
          ) : subtitle ? (
            <span className={cn("text-xs", active.disabled ? "text-destructive" : "text-muted-foreground")}>
              {subtitle}
            </span>
          ) : null}
        </div>
      )}

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-4" dir="ltr">
          <ArrowButton
            direction="prev"
            disabled={activeIndex <= 0}
            onClick={() => onActiveChange(clamp(activeIndex - 1, items.length))}
          />
          <ArrowButton
            direction="next"
            disabled={activeIndex >= items.length - 1}
            onClick={() => onActiveChange(clamp(activeIndex + 1, items.length))}
          />
        </div>
      )}
    </div>
  )
}

function IconTile({ item, active }: { item: PaymentCarouselItem; active: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-[1.75rem] border transition-colors",
        active
          ? "border-primary/60 bg-card shadow-[0_20px_50px_-12px_var(--primary)] ring-2 ring-primary/50"
          : "border-border/60 bg-card/70",
        item.disabled && "grayscale",
      )}
    >
      <span className="relative flex h-24 w-24 items-center justify-center">
        {item.iconSrc ? (
          <Image
            src={item.iconSrc}
            alt=""
            width={96}
            height={96}
            draggable={false}
            className="h-24 w-24 select-none object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]"
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 [&>svg]:h-10 [&>svg]:w-10">
            {item.iconNode}
          </span>
        )}
      </span>
    </div>
  )
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next"
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous" : "Next"}
      className="active:scale-press flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted text-foreground transition-[background-color,opacity] hover:bg-accent disabled:opacity-35"
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}

function clamp(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index))
}

function clampNum(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
