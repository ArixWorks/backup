import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The canonical page header for storefront routes: an icon + title (h1) with an
 * optional supporting line, an optional breadcrumb trail, and an optional
 * trailing action slot. Use this on every storefront page instead of
 * hand-rolling `<header><h1 class="flex items-center gap-2 …">…`.
 *
 * Responsive behaviour: title uses fluid typography so it scales smoothly from
 * phone → desktop with no stepped jumps, and the breadcrumb (desktop-oriented
 * context) only appears on the web shell at md+ where there's room for it.
 */
export type Crumb = { label: string; href?: string }

export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
  breadcrumbs,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  breadcrumbs?: Crumb[]
  className?: string
}) {
  return (
    <header className={cn("space-y-1", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav
          aria-label="breadcrumb"
          className="mb-1.5 hidden items-center gap-1 text-xs text-muted-foreground web:md:flex"
        >
          {breadcrumbs.map((crumb, i) => {
            const last = i === breadcrumbs.length - 1
            return (
              <span key={i} className="flex items-center gap-1">
                {crumb.href && !last ? (
                  <Link href={crumb.href} className="transition-colors hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={cn(last && "text-foreground")} aria-current={last ? "page" : undefined}>
                    {crumb.label}
                  </span>
                )}
                {!last ? <ChevronLeft className="size-3.5 rtl:rotate-180" aria-hidden /> : null}
              </span>
            )
          })}
        </nav>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <h1 className="flex items-center gap-2 text-fluid-xl font-extrabold text-balance">
          {Icon ? <Icon className="size-5 shrink-0 text-primary web:lg:size-6" aria-hidden /> : null}
          {title}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className="text-pretty text-fluid-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </header>
  )
}
