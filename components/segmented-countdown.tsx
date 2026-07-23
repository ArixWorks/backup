"use client"

import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { msUntil } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

/**
 * Fragment-style segmented countdown: separate boxes for days / hours / minutes
 * / seconds. Direction-agnostic (numbers stay LTR). Leading zero-value segments
 * are hidden until they become relevant (e.g. days box only shows when > 0).
 */
export function SegmentedCountdown({
  target,
  onComplete,
  className,
  compact,
  /** Seconds remaining below which the whole widget turns red and blinks. */
  blinkBelowSec = 60,
}: {
  target: string | Date
  onComplete?: () => void
  className?: string
  compact?: boolean
  blinkBelowSec?: number
}) {
  const { t } = useI18n()
  const [ms, setMs] = useState(() => msUntil(target))

  useEffect(() => {
    setMs(msUntil(target))
    const id = setInterval(() => {
      const next = msUntil(target)
      setMs(next)
      if (next <= 0) {
        clearInterval(id)
        onComplete?.()
      }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeof target === "string" ? target : target.getTime()])

  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  // Final-stretch urgency: the entire widget turns red and blinks, accelerating
  // as it nears zero. Blink period eases from ~1s at the threshold down to
  // ~0.28s in the last few seconds.
  const blink = ms > 0 && totalSec < blinkBelowSec
  const blinkSpeed = blink ? Math.max(0.28, 0.28 + (totalSec / blinkBelowSec) * 0.72) : undefined

  const segments = [
    { value: days, label: t("adetail.days"), show: days > 0 },
    { value: hours, label: t("adetail.hours"), show: true },
    { value: mins, label: t("adetail.mins"), show: true },
    { value: secs, label: t("adetail.secs"), show: true },
  ].filter((s) => s.show)

  return (
    <div
      dir="ltr"
      className={cn("flex items-stretch gap-2", blink && "countdown-urgent", className)}
      style={blink ? ({ "--blink-speed": `${blinkSpeed}s` } as CSSProperties) : undefined}
    >
      {segments.map((s) => (
        <div
          key={s.label}
          className={cn(
            "flex flex-1 flex-col items-center justify-center rounded-xl border tabular-nums",
            compact ? "px-2 py-1.5" : "px-2.5 py-2.5",
            blink ? "border-destructive/50 bg-destructive/10" : "border-border/70 bg-secondary/50",
          )}
        >
          <span
            className={cn(
              "font-extrabold leading-none",
              compact ? "text-lg" : "text-2xl",
              blink ? "text-destructive" : "text-foreground",
            )}
          >
            {s.value.toString().padStart(2, "0")}
          </span>
          <span
            className={cn(
              "mt-1 text-[10px] font-medium uppercase tracking-wide",
              blink ? "text-destructive/80" : "text-muted-foreground",
            )}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}
