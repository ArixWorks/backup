"use client"

import { useEffect, useRef } from "react"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Accessible selection checkbox for admin bulk actions. Built on a native
 * <input type="checkbox"> (no extra dependency) with a styled overlay so it
 * matches the design tokens and supports an indeterminate ("some selected")
 * state for the header row.
 */
export function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  className,
  stopPropagation = true,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  label: string
  className?: string
  /** Prevent the click from bubbling to a parent link/card. Defaults to true. */
  stopPropagation?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked
  }, [indeterminate, checked])

  return (
    <span
      className={cn("relative inline-flex h-5 w-5 shrink-0 items-center justify-center", className)}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation()
      }}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={onChange}
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation()
        }}
        className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-[5px] border border-input bg-background text-primary-foreground transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background",
          (checked || indeterminate) && "border-primary bg-primary",
        )}
      >
        {checked ? (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        ) : indeterminate ? (
          <Minus className="h-3.5 w-3.5" strokeWidth={3} />
        ) : null}
      </span>
    </span>
  )
}
