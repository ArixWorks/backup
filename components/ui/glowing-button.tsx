"use client"

import type { ButtonHTMLAttributes, CSSProperties } from "react"
import { cn } from "@/lib/utils"

/**
 * Button with a luminous edge bar that slides out of frame on hover.
 *
 * `glow` accepts ANY css colour, which is why this takes a colour string rather
 * than the reference implementation's hex + `hexToRgba()` helper: this app's
 * palette is authored in `oklch` design tokens across several themes, so hex
 * parsing would break the moment a token is passed. `color-mix()` derives the
 * translucent wash from whatever colour arrives, tokens included, so the button
 * follows the active palette instead of hard-coding a swatch.
 *
 * The bar sits on the physical right edge (as in the source design) rather than
 * the logical inline end, because Tailwind's `translate-x` is not direction
 * aware - under RTL a logical edge would slide the bar inward instead of out.
 */
export function GlowingButton({
  children,
  className,
  glow = "var(--chart-1)",
  active = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Any css colour - prefer a design token, e.g. `var(--chart-2)`. */
  glow?: string
  /** Pins the glow on and deepens the wash, for a selected item. */
  active?: boolean
}) {
  return (
    <button
      type="button"
      style={
        {
          "--glow": glow,
          "--glow-via": `color-mix(in oklab, ${glow} ${active ? "16%" : "7%"}, transparent)`,
          "--glow-to": `color-mix(in oklab, ${glow} ${active ? "40%" : "22%"}, transparent)`,
        } as CSSProperties
      }
      className={cn(
        // Tighter padding/type below `sm` so a row of these still fits a 360px
        // phone without the rail having to scroll.
        "relative isolate flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md border border-r-0 bg-gradient-to-t px-2 text-xs transition-colors duration-200 sm:px-4 sm:text-sm",
        "from-background to-muted text-foreground",
        "focus-visible:ring-2 focus-visible:ring-[var(--glow)] focus-visible:outline-none",
        // Colour wash bleeding in from the glow edge, plus a hairline top sheen.
        "after:absolute after:inset-0 after:rounded-[inherit] after:bg-gradient-to-r after:from-transparent after:from-40% after:via-[var(--glow-via)] after:via-70% after:to-[var(--glow-to)]",
        "after:shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_15%,transparent)]",
        // The light bar. Slides past the edge on hover (and is clipped away by
        // overflow-hidden); a selected button keeps it planted so the active
        // state survives the pointer leaving.
        "before:absolute before:inset-y-[20%] before:right-0 before:z-10 before:w-[5px] before:rounded-l before:bg-[var(--glow)] before:shadow-[-2px_0_10px_var(--glow)] before:transition-transform before:duration-200 motion-reduce:before:transition-none",
        active ? "border-[color-mix(in_oklab,var(--glow)_45%,transparent)]" : "border-border hover:before:translate-x-full",
        className,
      )}
      {...props}
    >
      {/* Above the wash so the label never loses contrast to the gradient. */}
      <span className="relative z-20 flex items-center gap-1.5">{children}</span>
    </button>
  )
}
