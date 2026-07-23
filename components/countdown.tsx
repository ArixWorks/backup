"use client"

import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { msUntil, formatCountdown } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

export function Countdown({
  target,
  onComplete,
  className,
  prefix,
  completedLabel,
  /** Seconds remaining below which the text turns red and blinks (accelerating). */
  blinkBelowSec = 60,
}: {
  target: string | Date
  onComplete?: () => void
  className?: string
  prefix?: string
  /** Text shown when the countdown reaches zero. Defaults to "ended". */
  completedLabel?: string
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
  const blink = ms > 0 && totalSec < blinkBelowSec
  const blinkSpeed = blink ? Math.max(0.28, 0.28 + (totalSec / blinkBelowSec) * 0.72) : undefined

  return (
    <span
      className={cn(
        "tabular-nums",
        blink && "countdown-urgent",
        className,
      )}
      style={blink ? ({ "--blink-speed": `${blinkSpeed}s` } as CSSProperties) : undefined}
      dir="ltr"
    >
      {prefix}
      {ms <= 0 ? (completedLabel ?? t("common.ended")) : formatCountdown(ms)}
    </span>
  )
}
