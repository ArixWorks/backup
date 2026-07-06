import { cn } from "@/lib/utils"

/**
 * Responsive grid primitive. Two modes:
 *
 *  - `min`: truly fluid — `repeat(auto-fill, minmax(min, 1fr))`. Columns are
 *    derived from available width, so it fills ultrawide monitors with more
 *    columns automatically and never needs breakpoint bookkeeping. Best for
 *    card/product grids.
 *  - `cols`: explicit column counts per breakpoint when the design calls for a
 *    fixed rhythm (e.g. exactly 2 → 3 → 4). Provide `{ base, sm, lg, xl }`.
 *
 * Gap scales fluidly by default. This is the single grid the whole app uses so
 * multi-column layouts stay consistent from 320px to 2560px.
 */
type ColSpec = { base?: number; sm?: number; md?: number; lg?: number; xl?: number; "2xl"?: number }

const COL_CLASS: Record<string, Record<number, string>> = {
  base: { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" },
  sm: { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" },
  md: { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" },
  lg: { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" },
  xl: { 2: "xl:grid-cols-2", 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5", 6: "xl:grid-cols-6" },
  "2xl": { 3: "2xl:grid-cols-3", 4: "2xl:grid-cols-4", 5: "2xl:grid-cols-5", 6: "2xl:grid-cols-6" },
}

function colsToClasses(cols: ColSpec): string {
  return Object.entries(cols)
    .map(([bp, n]) => COL_CLASS[bp]?.[n as number])
    .filter(Boolean)
    .join(" ")
}

type AutoGridProps = React.ComponentProps<"div"> & {
  /** Minimum column width for the fluid `auto-fill` mode (e.g. "16rem"). */
  min?: string
  /** Explicit per-breakpoint columns (overrides `min` when provided). */
  cols?: ColSpec
  /** Tailwind gap class; defaults to a fluid gap. */
  gap?: string
}

export function AutoGrid({ min = "15rem", cols, gap, className, style, children, ...props }: AutoGridProps) {
  const useFluid = !cols
  return (
    <div
      className={cn("grid", gap ?? "[gap:var(--space-fluid-sm)]", cols && colsToClasses(cols), className)}
      style={
        useFluid
          ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}, 100%), 1fr))`, ...style }
          : style
      }
      {...props}
    >
      {children}
    </div>
  )
}
