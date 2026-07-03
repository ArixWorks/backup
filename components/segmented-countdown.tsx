"use client"

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
}: {
  target: string | Date
  onComplete?: () => void
  className?: string
  compact?: boolean
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
  const urgent = ms > 0 && ms < 60 * 60 * 1000

  const segments = [
    { value: days, label: t("adetail.days"), show: days > 0 },
    { value: hours, label: t("adetail.hours"), show: true },
    { value: mins, label: t("adetail.mins"), show: true },
    { value: secs, label: t("adetail.secs"), show: true },
  ].filter((s) => s.show)

  return (
    <div dir="ltr" className={cn("flex items-stretch gap-2", className)}>
      {segments.map((s, i) => (
        <div
          key={s.label}
          className={cn(
            "flex flex-1 flex-col items-center justify-center rounded-xl border border-border/70 bg-secondary/50 tabular-nums",
            compact ? "px-2 py-1.5" : "px-2.5 py-2.5",
            urgent && i === segments.length - 1 && "border-destructive/40",
          )}
        >
          <span
            className={cn(
              "font-extrabold leading-none",
              compact ? "text-lg" : "text-2xl",
              urgent && i === segments.length - 1 ? "text-destructive" : "text-foreground",
            )}
          >
            {s.value.toString().padStart(2, "0")}
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}
