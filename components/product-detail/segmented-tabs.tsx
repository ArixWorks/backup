"use client"

import { useId, useState, type ReactNode } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"

export type SegmentedTab = {
  id: string
  label: string
  content: ReactNode
}

/**
 * Lightweight, fully themed segmented tabs used to group the long-form product
 * sections (description / reviews / questions) so the page isn't an
 * overwhelming single scroll. No extra dependency — a sliding pill indicator
 * (shared layout animation) provides the polish. Accessible: proper
 * tablist/tab/tabpanel roles, arrow-key navigation, and roving focus.
 */
export function SegmentedTabs({ tabs, defaultTab }: { tabs: SegmentedTab[]; defaultTab?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)
  const groupId = useId()

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    e.preventDefault()
    // RTL-aware: ArrowRight moves to the previous (visually right-hand) tab.
    const dir = e.key === "ArrowRight" ? -1 : 1
    const next = (index + dir + tabs.length) % tabs.length
    setActive(tabs[next].id)
    document.getElementById(`${groupId}-tab-${tabs[next].id}`)?.focus()
  }

  return (
    <section className="space-y-4">
      <div
        role="tablist"
        aria-label="sections"
        className="flex items-center gap-1 rounded-2xl border border-border bg-secondary/40 p-1"
      >
        {tabs.map((tab, i) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              id={`${groupId}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${groupId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "relative flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors",
                selected ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {selected && (
                <motion.span
                  layoutId={`${groupId}-tab-pill`}
                  className="absolute inset-0 rounded-xl bg-primary shadow-sm shadow-primary/20"
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                />
              )}
              <span className="relative z-[1]">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${groupId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${groupId}-tab-${tab.id}`}
          hidden={tab.id !== active}
        >
          {tab.id === active && tab.content}
        </div>
      ))}
    </section>
  )
}
