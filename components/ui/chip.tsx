"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Pill-shaped filter / category chip — the single source of truth for the
 * horizontal "scroller" chips used in browse + filter surfaces (flash, auctions,
 * categories). Token-driven so it recolors with the active theme. For stateful
 * follow/subscribe pills with their own loading/optimistic states, compose on top
 * of this base via `className` rather than re-implementing the shape.
 */
export const chipBase =
  "active:scale-press inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quint)] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

export function Chip({
  active = false,
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type={type}
      data-active={active || undefined}
      className={cn(
        chipBase,
        active
          ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-accent)]"
          : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className,
      )}
      {...props}
    />
  )
}
