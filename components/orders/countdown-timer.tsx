"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Live count-down to `dueAt`. Renders a circular progress ring plus mm:ss.
 * `totalSeconds` is the full budget (estimatedMinutes*60 + granted extensions)
 * used only to fill the ring; the truth is always `dueAt`. When time runs out
 * the ring turns to the "overdue" tone and counts up the overflow so the buyer
 * still sees motion (reassures them the order is actively being worked on).
 */
export function CountdownTimer({
  dueAt,
  totalSeconds,
  labels,
  className,
}: {
  dueAt: string
  totalSeconds: number
  labels: { remaining: string; overdue: string }
  className?: string
}) {
  const target = new Date(dueAt).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const diffMs = target - now
  const overdue = diffMs <= 0
  const absSec = Math.floor(Math.abs(diffMs) / 1000)
  const mm = String(Math.floor(absSec / 60)).padStart(2, "0")
  const ss = String(absSec % 60).padStart(2, "0")

  // Ring fill: fraction of budget remaining (clamped 0..1).
  const remainingSec = Math.max(0, Math.floor(diffMs / 1000))
  const frac = totalSeconds > 0 ? Math.min(1, Math.max(0, remainingSec / totalSeconds)) : 0
  const R = 52
  const C = 2 * Math.PI * R
  const dash = overdue ? 0 : C * (1 - frac)

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" className="stroke-muted" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={dash}
            className={cn(
              "transition-[stroke-dashoffset] duration-1000 ease-linear",
              overdue ? "stroke-destructive" : "stroke-primary",
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Clock className={cn("mb-1 h-4 w-4", overdue ? "text-destructive" : "text-primary")} aria-hidden />
          <span className={cn("font-mono text-2xl font-bold tabular-nums", overdue && "text-destructive")}>
            {overdue ? "+" : ""}
            {mm}:{ss}
          </span>
        </div>
      </div>
      <p className={cn("text-sm font-medium", overdue ? "text-destructive" : "text-muted-foreground")}>
        {overdue ? labels.overdue : labels.remaining}
      </p>
    </div>
  )
}
