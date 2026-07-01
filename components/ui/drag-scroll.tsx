"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Horizontal "rail" that pans by dragging — like swiping through a photo
 * gallery — instead of showing a scrollbar. Native touch swipe still works; we
 * additionally enable click-and-drag panning for mouse/trackpad and hide the
 * scrollbar via the `.no-scrollbar` utility. A small drag threshold suppresses
 * the click that would otherwise fire on a child (e.g. a chip) after a pan, so
 * dragging never accidentally selects a category.
 */
export function DragScroll({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const ref = React.useRef<HTMLDivElement>(null)
  const state = React.useRef({ down: false, dragging: false, startX: 0, startLeft: 0 })

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Only hijack primary mouse button; let touch use native momentum scroll.
    if (e.pointerType === "mouse" && e.button !== 0) return
    if (e.pointerType !== "mouse") return
    const el = ref.current
    if (!el) return
    state.current = { down: true, dragging: false, startX: e.clientX, startLeft: el.scrollLeft }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el || !state.current.down) return
    const dx = e.clientX - state.current.startX
    if (!state.current.dragging && Math.abs(dx) > 6) {
      state.current.dragging = true
      el.setPointerCapture(e.pointerId)
      el.style.cursor = "grabbing"
    }
    if (state.current.dragging) {
      // RTL-safe: scrollLeft delta works the same regardless of direction.
      el.scrollLeft = state.current.startLeft - dx
    }
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (el) el.style.cursor = ""
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    state.current.down = false
  }

  // Swallow the click that follows a real drag so children aren't activated.
  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (state.current.dragging) {
      e.preventDefault()
      e.stopPropagation()
      state.current.dragging = false
    }
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      className={cn(
        "no-scrollbar flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [scroll-snap-type:x_proximity] md:cursor-grab",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
