"use client"

import { Check, X, Loader2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { orderCopy } from "@/lib/i18n/order-copy"
import type { RoadmapStep } from "@/lib/orders/shared"

/**
 * Vertical colourful roadmap of an order's fulfilment. Each step reflects its
 * state (done / active / upcoming / cancelled) with a distinct colour, icon,
 * and a connecting rail that fills up to the active node. Titles/descriptions
 * are localized via the order-copy step catalog. RTL-aware.
 */
export function RoadmapStepper({ steps }: { steps: RoadmapStep[] }) {
  const { locale } = useI18n()
  const c = orderCopy(locale)

  return (
    <ol className="relative flex flex-col gap-0" aria-label={c.timeline}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1
        const done = step.state === "done"
        const active = step.state === "active"
        const cancelled = step.state === "cancelled"
        const copy = c.steps[step.key]
        return (
          <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast && (
              <span
                className={cn(
                  "absolute top-8 h-[calc(100%-1rem)] w-0.5 ltr:left-4 rtl:right-4",
                  done ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-primary/15 text-primary",
                cancelled && "border-destructive bg-destructive/15 text-destructive",
                step.state === "upcoming" && "border-border bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              {done ? (
                <Check className="h-4 w-4" />
              ) : cancelled ? (
                <X className="h-4 w-4" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Circle className="h-2.5 w-2.5 fill-current" />
              )}
            </span>
            <div className="flex flex-col pt-1">
              <span
                className={cn(
                  "text-sm font-semibold leading-tight",
                  active && "text-primary",
                  cancelled && "text-destructive",
                  step.state === "upcoming" && "text-muted-foreground",
                )}
              >
                {copy.title}
              </span>
              {copy.desc && <span className="mt-0.5 text-xs text-muted-foreground text-pretty">{copy.desc}</span>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
