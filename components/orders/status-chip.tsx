"use client"

import { cn } from "@/lib/utils"
import { statusTone, type StatusTone } from "@/lib/orders/shared"
import { useI18n } from "@/components/i18n-provider"
import { orderCopy } from "@/lib/i18n/order-copy"

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  info: "bg-primary/10 text-primary",
  progress: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
}

const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-primary",
  progress: "bg-primary animate-pulse",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
}

/** Colored status pill with a tone-driven dot. Localized label. */
export function StatusChip({ status, className }: { status: string; className?: string }) {
  const { locale } = useI18n()
  const tone = statusTone(status)
  const label = orderCopy(locale).statuses[status] ?? status
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[tone])} aria-hidden="true" />
      {label}
    </span>
  )
}
