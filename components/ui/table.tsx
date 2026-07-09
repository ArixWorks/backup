"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const ref = React.useRef<HTMLDivElement>(null)
  const state = React.useRef({ down: false, dragging: false, startX: 0, startLeft: 0 })

  // Site-wide scrollbars are hidden and desktops have no touch, so wide tables
  // would be impossible to pan. We enable click-and-drag panning for the mouse
  // (native touch/trackpad scroll still works) with a small threshold so a real
  // click on a button/link inside the table is never swallowed.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return
    const el = ref.current
    if (!el || el.scrollWidth <= el.clientWidth) return
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
      // RTL-safe: scrollLeft delta behaves the same regardless of direction.
      el.scrollLeft = state.current.startLeft - dx
    }
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (el) el.style.cursor = ""
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    state.current.down = false
  }

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
      data-slot="table-container"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      className="relative w-full overflow-x-auto overscroll-x-contain md:cursor-grab"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
