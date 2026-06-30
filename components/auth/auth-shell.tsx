import type { ReactNode } from "react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"

/**
 * The canonical full-screen shell for every authentication / account-recovery
 * screen (login, forgot/reset password, email verification). Owns the page
 * chrome so the journey is pixel-consistent:
 * - centered, safe-area-aware viewport layout (Telegram Mini App friendly)
 * - a single subtle gold radial glow behind the card
 * - the premium glass card with the brand Logo + optional title/description
 *
 * Screen-specific content goes in `children`; extra cards (e.g. the privacy
 * panel on login) go in `footer`. Pure presentational + server-compatible —
 * `dir` is inherited from <html>, so no client hooks are needed.
 */
export function AuthShell({
  title,
  description,
  srHeading,
  children,
  footer,
  contentClassName,
}: {
  /** Visible card heading. */
  title?: ReactNode
  /** Supporting copy under the heading. */
  description?: ReactNode
  /** Screen-reader-only heading (use when the brand name is the visual title). */
  srHeading?: string
  children: ReactNode
  /** Optional content rendered below the card (e.g. privacy/trust panel). */
  footer?: ReactNode
  contentClassName?: string
}) {
  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center px-4 py-10 pt-safe pb-safe">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 35%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)",
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="glass rounded-3xl border border-primary/15 p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo />
            {srHeading ? <h1 className="sr-only">{srHeading}</h1> : null}
            {title ? (
              <h1 className="text-balance text-xl font-extrabold text-foreground">{title}</h1>
            ) : null}
            {description ? (
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className={cn("mt-6", contentClassName)}>{children}</div>
        </div>
        {footer}
      </div>
    </main>
  )
}
