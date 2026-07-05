"use client"

import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Star rating display or input. When `onChange` is provided it becomes an
 * interactive 1–5 picker; otherwise it renders a read-only (optionally
 * fractional) rating. Direction-agnostic so it works in both RTL and LTR.
 */
export function StarRating({
  value,
  onChange,
  size = 16,
  className,
}: {
  value: number
  onChange?: (value: number) => void
  size?: number
  className?: string
}) {
  const interactive = !!onChange
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)} role={interactive ? "radiogroup" : "img"}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value >= star
        const half = !filled && value >= star - 0.5
        const Icon = (
          <Star
            className={cn(
              "transition-colors",
              filled || half ? "fill-primary text-primary" : "fill-transparent text-muted-foreground/40",
            )}
            style={{ width: size, height: size }}
            aria-hidden="true"
          />
        )
        if (!interactive) return <span key={star}>{Icon}</span>
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star}`}
            onClick={() => onChange(star)}
            className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {Icon}
          </button>
        )
      })}
    </div>
  )
}
