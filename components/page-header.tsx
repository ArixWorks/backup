import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The canonical page header for storefront routes: an icon + title (h1) with an
 * optional supporting line, and an optional trailing action slot. Use this on
 * every storefront page instead of hand-rolling
 * `<header><h1 class="flex items-center gap-2 text-xl font-extrabold">…`.
 * Keeps title typography, icon sizing, and spacing identical app-wide.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("space-y-1", className)}>
      <div className="flex items-start justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-balance">
          {Icon ? <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden /> : null}
          {title}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </header>
  )
}
