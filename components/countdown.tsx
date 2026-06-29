"use client"

import { useEffect, useState } from "react"
import { msUntil, formatCountdown } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

export function Countdown({
  target,
  onComplete,
  className,
  prefix,
}: {
  target: string | Date
  onComplete?: () => void
  className?: string
  prefix?: string
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

  const urgent = ms > 0 && ms < 60 * 1000

  return (
    <span
      className={cn(
        "tabular-nums",
        urgent && "text-destructive",
        className,
      )}
      dir="ltr"
    >
      {prefix}
      {ms <= 0 ? t("common.ended") : formatCountdown(ms)}
    </span>
  )
}
