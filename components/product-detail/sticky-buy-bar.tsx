"use client"

import type { ReactNode } from "react"

/**
 * Fixed bottom purchase bar shared by every detail template. It pins the
 * primary call-to-action (buy / bid / buy-now) to the bottom of the screen so
 * it's always reachable, with a price/summary block on the start side and the
 * action(s) on the end side. The bottom nav is hidden on detail routes, so this
 * bar owns the bottom edge and its safe-area inset.
 *
 * Layout is intentionally slot-based so the shop bar (price + optional plan
 * dropdown + buy) and the auction bar (live price + bid) can share one chrome.
 */
export function StickyBuyBar({
  info,
  action,
}: {
  /** Start-side summary — typically price + small label. */
  info: ReactNode
  /** End-side controls — buy button, or plan dropdown + buy. */
  action: ReactNode
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card/95 backdrop-blur-md px-safe pb-safe shadow-[0_-10px_30px_-16px_rgba(0,0,0,0.7)]"
      role="region"
      aria-label="purchase"
    >
      <div className="mx-auto flex w-full max-w-[var(--shell-max)] items-center gap-3 px-4 py-3 web:lg:max-w-[var(--content-max)]">
        <div className="min-w-0 flex-1">{info}</div>
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      </div>
    </div>
  )
}
