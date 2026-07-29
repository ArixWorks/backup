"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import { motion } from "motion/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const GatewayModel3D = dynamic(
  () => import("@/components/wallet/gateway-model-3d").then((m) => m.GatewayModel3D),
  { ssr: false },
)

const GatewayLottie = dynamic(
  () => import("@/components/wallet/gateway-lottie").then((m) => m.GatewayLottie),
  { ssr: false },
)

export type PaymentCarouselItem = {
  id: string
  title: string
  subtitle?: string
  /** Path to a real 3D model (.glb). Rendered spinning on the center tile. */
  modelSrc?: string
  /** Path to a Lottie JSON. Rendered with its own built-in effect (no spin). */
  lottieSrc?: string
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
 * Swipeable payment picker modeled on premium wallet bots: one large glossy
 * 3D icon tile in the center, small dimmed icon tiles on the sides (no 3D
 * rotation - a flat slide + scale, exactly like the reference video), the
 * active label below, then round prev/next arrows. Fully controlled via
 * `activeIndex` + `onActiveChange`; tapping the centered tile fires
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

  // Side tiles at |pos|=1 render at ~scale 0.48 of the 136px tile, so they
  // extend ~34px past their center. Keep spacing small enough that they stay
  // fully inside the container instead of being clipped by overflow-hidden.
  const TILE = 136
  const sideHalf = (TILE * 0.48) / 2 + 8
  const spacing =
    width > 0 ? Math.max(104, Math.min(width * 0.42, width / 2 - sideHalf, 170)) : 140
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
      <div ref={containerRef} className="relative h-40 w-full overflow-hidden">
        <motion.div
          className="absolute inset-0"
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
            const dragging = drag !== 0
            // Flat coverflow: center tile is full size, neighbours shrink and dim.
            const scale = Math.max(0.42, 1 - abs * 0.52)
            return (
              <motion.button
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
                className="absolute left-1/2 top-1/2 -ml-[4.25rem] -mt-[4.25rem] h-[8.5rem] w-[8.5rem] will-change-transform focus:outline-none"
                initial={false}
                animate={{
                  x: pos * spacing,
                  scale,
                  opacity: hidden ? 0 : Math.max(0.2, 1 - abs * 0.4),
                  filter: `blur(${abs > 0.5 ? Math.min(abs * 1.5, 3) : 0}px)`,
                }}
                transition={
                  dragging
                    ? { type: "tween", duration: 0 }
                    : { type: "spring", stiffness: 210, damping: 24, mass: 0.9 }
                }
                style={{
                  zIndex: 100 - Math.round(abs * 10),
                  pointerEvents: hidden ? "none" : "auto",
                }}
              >
                <IconTile item={item} />
              </motion.button>
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

function IconTile({ item }: { item: PaymentCarouselItem }) {
  return (
    <div className={cn("h-full w-full", item.disabled && "grayscale")}>
      {item.lottieSrc ? (
        // pointer-events-none lets taps and drags pass through to the tile
        // button / drag surface. The Lottie keeps its own glow effect only.
        <div className="pointer-events-none h-full w-full">
          <GatewayLottie src={item.lottieSrc} />
        </div>
      ) : item.modelSrc ? (
        // pointer-events-none lets taps and drags pass through the WebGL
        // canvas to the tile button / drag surface.
        <div className="pointer-events-none h-full w-full">
          <GatewayModel3D src={item.modelSrc} />
        </div>
      ) : item.iconSrc ? (
        <Image
          src={item.iconSrc}
          alt=""
          width={272}
          height={272}
          draggable={false}
          className="h-full w-full select-none rounded-[1.9rem] object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center [&>svg]:h-14 [&>svg]:w-14">
          {item.iconNode}
        </span>
      )}
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
      className="active:scale-press flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted text-primary transition-[background-color,opacity] hover:bg-accent disabled:opacity-35"
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}

function clamp(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index))
}
