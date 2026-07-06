import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Reusable page header shared across storefront + admin pages.
 *
 * Responsive by design (not scaled): on the web-desktop dashboard it renders a
 * breadcrumb trail, a large fluid title and a right-aligned action cluster; on
 * the mini-app / mobile it collapses to a compact title row (breadcrumb hidden)
 * so it stays calm and space-efficient. Fixed heights + reserved rows keep it
 * CLS-free when actions load in.
 */
export type Crumb = { label: string; href?: string }

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  icon,
  className,
}: {
  title: string
  description?: string
  breadcrumb?: Crumb[]
  actions?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("[margin-block-end:var(--space-fluid-md)]", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        // Breadcrumbs are desktop-only context; hidden on the compact shell.
        <nav aria-label="Breadcrumb" className="mb-2 hidden web:lg:block">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {breadcrumb.map((c, i) => {
              const last = i === breadcrumb.length - 1
              return (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                  {c.href && !last ? (
                    <Link href={c.href} className="transition-colors hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span className={cn(last && "font-medium text-foreground")}>{c.label}</span>
                  )}
                  {!last && <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-60 rtl:rotate-180" />}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 web:lg:h-12 web:lg:w-12">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-fluid-xl truncate font-extrabold text-foreground web:lg:text-fluid-2xl">
              {title}
            </h1>
            {description && (
              <p className="text-fluid-sm mt-0.5 text-pretty text-muted-foreground">{description}</p>
            )}
          </div>
        </div>

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
