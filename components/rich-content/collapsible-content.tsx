"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

/**
 * CollapsibleContent — wraps any long-form block (a `RichContent` description,
 * rules, prize details, …) and, when it is taller than `collapsedHeight`,
 * clamps it behind a soft fade with an animated "show more / show less" toggle.
 *
 * The fade is a CSS mask on the clipping box (background-independent, so it
 * looks correct on cards, plain pages, dialogs, …). Height and chevron animate
 * with a spring and fully collapse back on a second tap. Respects reduced
 * motion and re-measures on resize / late-loading content.
 */
export function CollapsibleContent({
  children,
  collapsedHeight = 104,
  className,
}: {
  children: ReactNode
  /** Clamp height in px before the fade kicks in (~4–5 lines by default). */
  collapsedHeight?: number
  className?: string
}) {
  const { t } = useI18n()
  const reduce = useReducedMotion()
  const contentRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const measure = () => setOverflowing(el.scrollHeight > collapsedHeight + 16)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    // Late-loading fonts/images can change the height after first paint.
    const timer = window.setTimeout(measure, 300)
    return () => {
      ro.disconnect()
      window.clearTimeout(timer)
    }
  }, [collapsedHeight])

  const collapsed = overflowing && !expanded

  return (
    <div className={cn("relative", className)}>
      <motion.div
        initial={false}
        animate={{ height: !overflowing || expanded ? "auto" : collapsedHeight }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 32 }}
        className="overflow-hidden"
        style={
          collapsed
            ? {
                maskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, #000 45%, transparent 100%)",
              }
            : undefined
        }
      >
        <div ref={contentRef}>{children}</div>
      </motion.div>

      {overflowing && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs font-semibold text-foreground/80 shadow-sm backdrop-blur transition-colors hover:border-primary/50 hover:text-primary"
          >
            <span>{expanded ? t("common.showLess") : t("common.showMore")}</span>
            <motion.span
              aria-hidden
              className="inline-flex"
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 22 }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </button>
        </div>
      )}
    </div>
  )
}
