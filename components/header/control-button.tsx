"use client"

import Link from "next/link"
import { forwardRef } from "react"
import { cn } from "@/lib/utils"

/**
 * Shared glassy control surface for every header affordance (wallet, language,
 * notifications). Centralising it here keeps the whole control cluster on one
 * visual system — identical height, radius, border, blur and hover/press/focus
 * feedback — so individual buttons never drift out of sync. 36px tall to hit a
 * comfortable Telegram touch target while staying compact on small phones.
 */
export const CONTROL_SURFACE = cn(
  "active:scale-press relative inline-flex h-9 items-center justify-center rounded-full",
  "border border-primary/20 bg-card/40 text-foreground/80 backdrop-blur-md",
  "shadow-[0_1px_0_0_oklch(1_0_0/0.05)_inset,0_2px_8px_-4px_oklch(0_0_0/0.5)]",
  "transition-[transform,background-color,border-color,color] duration-[var(--duration-fast)]",
  "hover:border-primary/45 hover:bg-card/70 hover:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55 focus-visible:ring-offset-0",
)

type HeaderControlProps = {
  /** Render as a link when provided, otherwise a button. */
  href?: string
  "aria-label": string
  className?: string
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>

/**
 * Polymorphic header control: a square icon button by default. Pass extra
 * padding via `className` (e.g. a pill with a label) to widen it.
 */
export const HeaderControl = forwardRef<HTMLButtonElement, HeaderControlProps>(
  function HeaderControl({ href, className, children, ...props }, ref) {
    const classes = cn(CONTROL_SURFACE, "w-9", className)
    if (href) {
      return (
        <Link href={href} aria-label={props["aria-label"]} className={classes}>
          {children}
        </Link>
      )
    }
    return (
      <button ref={ref} type="button" className={classes} {...props}>
        {children}
      </button>
    )
  },
)
