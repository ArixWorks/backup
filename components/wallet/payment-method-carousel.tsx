"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

export type PaymentCarouselItem = {
  id: string
  title: string
  subtitle?: string
  /** Path to an image icon (svg/png). Takes priority over `iconNode`. */
  iconSrc?: string
  /** Fallback node icon (e.g. a lucide icon) when no image is provided. */
  iconNode?: ReactNode
  /** Optional trailing text shown under the title (e.g. wallet balance). */
  meta?: string
  disabled?: boolean
  disabledHint?: string
}

/**
 * A coverflow-style rotating payment picker. The centered card is the active
 * selection; neighbours are rotated back in 3D and dimmed. Users swipe/drag
 * horizontally or tap a side card to rotate it to the center. Fully controlled
 * via `activeIndex` + `onActiveChange`; tapping the centered card fires
 * `onSelect` so the parent can advance the flow.
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

  const spacing = Math.max(120, width * 0.46)
  const dragFraction = spacing > 0 ? drag / spacing : 0

  function commitDrag(offsetX: number, velocityX: number) {
    setDrag(0)
    // Positive drag (finger moves right) reveals the previous card.
    if (offsetX > 45 || velocityX > 400) onActiveChange(clamp(activeIndex - 1, items.length))
    else if (offsetX < -45 || velocityX < -400) onActiveChange(clamp(activeIndex + 1, items.length))
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={containerRef} className="relative h-52 w-full [perspective:1100px]">
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
                onClick={() => {
                  if (Math.abs(drag) > 6) return
                  if (isActive) onSelect?.(index)
                  else onActiveChange(index)
                }}
                className={cn(
                  "absolute left-1/2 top-1/2 h-48 w-36 -translate-x-1/2 -translate-y-1/2 will-change-transform focus:outline-none",
                  drag === 0 && "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                )}
                style={{
                  transform: `translate(-50%, -50%) translateX(${pos * spacing}px) rotateY(${clampNum(-pos * 38, -48, 48)}deg) scale(${Math.max(0.62, 1 - abs * 0.26)})`,
                  opacity: hidden ? 0 : Math.max(0, 1 - abs * 0.42),
                  zIndex: 100 - Math.round(abs * 10),
                  pointerEvents: hidden ? "none" : "auto",
                }}
              >
                <Card item={item} active={isActive} />
              </button>
            )
          })}
        </motion.div>
      </div>

      {items.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onActiveChange(index)}
              aria-label={item.title}
              aria-current={index === activeIndex}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-300",
                index === activeIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Card({ item, active }: { item: PaymentCarouselItem; active: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-3 rounded-[1.75rem] border p-5 text-center",
        active
          ? "border-primary/60 bg-card shadow-[0_18px_45px_-12px_var(--primary)] ring-2 ring-primary/50"
          : "border-border bg-card/80 shadow-lg",
        item.disabled && "opacity-60",
      )}
    >
      <span
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-2xl",
          active ? "bg-primary/15" : "bg-muted",
        )}
      >
        {item.iconSrc ? (
          <Image src={item.iconSrc} alt="" width={40} height={40} className="h-10 w-10" />
        ) : (
          item.iconNode
        )}
      </span>
      <span className="flex min-w-0 flex-col items-center gap-0.5">
        <span className="line-clamp-1 text-sm font-bold text-foreground">{item.title}</span>
        {(item.disabled && item.disabledHint ? item.disabledHint : item.subtitle) && (
          <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
            {item.disabled && item.disabledHint ? item.disabledHint : item.subtitle}
          </span>
        )}
        {item.meta && (
          <span className="mt-0.5 text-xs font-semibold tabular-nums text-primary">{item.meta}</span>
        )}
      </span>
    </div>
  )
}

function clamp(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index))
}

function clampNum(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
