import { cn } from "@/lib/utils"

/**
 * Width-capping container used inside pages so content never stretches to
 * unreadable line lengths on large monitors. The app shell already offsets the
 * sidebar and pads gutters; this simply caps + centers the inner content.
 *
 *  - "content" (default): the standard dashboard column (~1280px).
 *  - "wide":   dense grids / tables that want more room (~1536px).
 *  - "narrow": reading / form flows kept tight (~576px), matching the mini-app.
 *
 * Widths come from CSS tokens so the whole app scales from one place.
 */
type ContainerWidth = "content" | "wide" | "narrow"

const WIDTHS: Record<ContainerWidth, string> = {
  content: "max-w-[var(--content-max)]",
  wide: "max-w-[var(--content-wide)]",
  narrow: "max-w-[var(--shell-max)]",
}

export function Container({
  width = "content",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { width?: ContainerWidth }) {
  return (
    <div className={cn("mx-auto w-full", WIDTHS[width], className)} {...props}>
      {children}
    </div>
  )
}

/**
 * Vertical rhythm wrapper. Spacing scales fluidly (tighter on phones, airier on
 * desktop) via the --space-fluid-* tokens so sections breathe correctly on
 * every device without stepped jumps.
 */
export function Section({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section className={cn("[margin-block-end:var(--space-fluid-md)]", className)} {...props}>
      {children}
    </section>
  )
}
