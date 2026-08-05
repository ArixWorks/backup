"use client"

import { Check, X, LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { orderCopy } from "@/lib/i18n/order-copy"
import type { RoadmapStep } from "@/lib/orders/shared"
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
} from "@/components/ui/stepper"

/**
 * Vertical roadmap of an order's fulfilment, built on the shared Stepper
 * primitive. Every node's look is driven by `data-state` rather than ad-hoc
 * colour props, so `done | active | cancelled | upcoming` stay visually
 * consistent with any other stepper in the app.
 *
 * The rail between two nodes is owned by the node ABOVE it and coloured from
 * that node's state: it represents progress already made, so a green-to-red
 * handoff reads correctly when an order fails mid-flow.
 *
 * Read-only by design (`interactive={false}`): it mirrors server state, so it
 * must not announce itself as a tablist or expose clickable tabs.
 * RTL-safe - the indicator rail is a centered flex column, not absolutely
 * positioned against a physical edge.
 */
export function RoadmapStepper({ steps }: { steps: RoadmapStep[] }) {
  const { locale } = useI18n()
  const c = orderCopy(locale)

  // The pointer the primitive compares against. `cancelled` counts as "reached"
  // so the failed node resolves to its own state instead of `completed`.
  const activeIndex = steps.findIndex((s) => s.state === "active" || s.state === "cancelled")
  const activeStep = activeIndex === -1 ? steps.length + 1 : activeIndex + 1

  return (
    <Stepper
      value={activeStep}
      orientation="vertical"
      interactive={false}
      indicators={{
        completed: <Check className="size-4" />,
        error: <X className="size-4" />,
        // The spinner is the whole point of an in-flight node, so it IS the
        // node's ring: sized to fill the indicator (28px content box inside the
        // size-8 circle) with a heavier stroke. At size-4 it sat concentric with
        // the indicator's own static border in the same purple, and two rings of
        // near-equal radius read as one static double ring - the rotation was
        // running but invisible. The active node drops its border below so this
        // arc is the only ring there.
        loading: <LoaderCircle className="size-7 animate-spin" strokeWidth={2.5} aria-hidden="true" />,
      }}
    >
      <StepperNav aria-label={c.timeline} className="w-full gap-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const done = step.state === "done"
          const active = step.state === "active"
          const cancelled = step.state === "cancelled"
          const copy = c.steps[step.key]

          return (
            <StepperItem
              key={step.key}
              step={i + 1}
              completed={done}
              loading={active}
              error={cancelled}
              className="gap-3"
            >
              {/* Indicator + rail share a centered column so the line always
                  meets the circle's middle in both LTR and RTL. */}
              <div className="flex flex-col items-center">
                <StepperIndicator
                  className={cn(
                    "size-8 border-2 border-border bg-muted text-muted-foreground transition-colors",
                    "data-[state=completed]:border-primary data-[state=completed]:bg-primary data-[state=completed]:text-primary-foreground",
                    // Transparent border, not `border-0`: the 2px ring still
                    // reserves its space so the circle keeps the exact same
                    // 32px footprint as its neighbours and the rail stays aligned.
                    "data-[state=active]:border-transparent data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
                    "data-[state=error]:border-destructive data-[state=error]:bg-destructive/15 data-[state=error]:text-destructive",
                  )}
                />
                {!isLast && (
                  <StepperSeparator
                    className={cn(
                      "my-1 min-h-4 flex-1",
                      done && "bg-primary",
                      cancelled && "bg-destructive/40",
                    )}
                  />
                )}
              </div>

              <div className={cn("flex flex-col gap-1", !isLast && "pb-6")}>
                <StepperTitle
                  className={cn(
                    "font-semibold",
                    "data-[state=active]:text-primary",
                    "data-[state=error]:text-destructive",
                    "data-[state=inactive]:text-muted-foreground",
                  )}
                >
                  {copy.title}
                </StepperTitle>
                {copy.desc && (
                  <StepperDescription className="text-xs text-pretty">{copy.desc}</StepperDescription>
                )}
              </div>
            </StepperItem>
          )
        })}
      </StepperNav>
    </Stepper>
  )
}
