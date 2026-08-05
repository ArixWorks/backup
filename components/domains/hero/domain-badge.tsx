"use client"

import { forwardRef } from "react"

/**
 * A single domain-extension pill.
 *
 * Styling is driven entirely by theme tokens (`primary`, `card`, `ring`) so the
 * pills always match the globe and whichever site theme is active, rather than
 * hardcoding an accent that clashes when the theme changes.
 *
 * Rendered as a real <button> so the orbiting labels stay keyboard reachable
 * and screen-reader friendly - the globe canvas itself is decorative.
 */
export const TldPill = forwardRef<
  HTMLButtonElement,
  {
    tld: string
    selectLabel: string
    onSelect: (tld: string) => void
    /** The pulse ring is decorative, so it is dropped on the minimal tier. */
    pulse?: boolean
    className?: string
  }
>(function TldPill({ tld, selectLabel, onSelect, pulse = true, className = "" }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(tld)}
      aria-label={`${selectLabel} ${tld}`}
      // Extensions are always Latin. Under RTL the leading dot is a neutral
      // character and flips to the wrong side (".com" renders as "com."), so
      // the pill is pinned to LTR regardless of page direction.
      dir="ltr"
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-card/80 px-2.5 py-1 font-mono text-xs font-semibold tracking-tight text-foreground shadow-lg shadow-primary/10 backdrop-blur-md transition-colors duration-200 hover:border-primary/60 hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className}`}
    >
      <span className="relative flex size-2 shrink-0 items-center justify-center">
        {pulse ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" aria-hidden="true" />
        ) : null}
        <span className="relative size-1.5 rounded-full bg-primary" aria-hidden="true" />
      </span>
      {tld}
    </button>
  )
})
