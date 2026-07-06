"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { useSidebar } from "@/components/layout/sidebar-context"
import { sidebarGroups, isNavItemActive } from "@/lib/nav-config"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Logo, BrandMark } from "@/components/logo"
import { CmsNavGroup } from "@/components/layout/cms-nav-group"

/**
 * Web-desktop navigation sidebar (RTL, sticky, collapsible).
 *
 * Rendered only inside WebShell on `lg+`; the mobile bottom nav / drawer is a
 * separate surface. Both consume `lib/nav-config`, so navigation can never
 * drift between form factors. Collapsed mode shows icon-only rails with
 * tooltips; expanded shows grouped labels.
 */
export function Sidebar() {
  const pathname = usePathname() ?? "/"
  const { t } = useI18n()
  const { collapsed, toggleCollapsed } = useSidebar()

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 border-e border-border/60 bg-card/40 backdrop-blur-xl web:lg:flex web:lg:flex-col",
        "transition-[width] duration-300 ease-out motion-reduce:transition-none",
      )}
      style={{ width: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)" }}
    >
      {/* Brand + collapse toggle */}
      <div className="flex h-[var(--header-h-web)] items-center gap-2 border-b border-border/60 px-3">
        <Link
          href="/"
          aria-label="SubIO"
          className={cn("flex min-w-0 items-center", collapsed && "justify-center")}
        >
          {collapsed ? <BrandMark className="h-9 w-9 shrink-0" /> : <Logo />}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={t("a11y.collapseSidebar")}
            className="tap-target ms-auto grid place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelRightClose className="size-5" />
          </button>
        )}
      </div>

      {/* Collapsed expand button */}
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={t("a11y.expandSidebar")}
          className="tap-target mx-auto mt-2 grid place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelRightOpen className="size-5" />
        </button>
      )}

      {/* Nav groups */}
      <nav aria-label={t("a11y.mainNav")} className="flex-1 overflow-y-auto px-2 py-3">
        {sidebarGroups.map((group, gi) => (
          <div key={gi} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground/70">
                {t(group.title)}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isNavItemActive(item, pathname)
                const Icon = item.icon
                const link = (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-fluid-sm font-medium transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-primary/12 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("size-5 shrink-0", active && "text-primary")} />
                    {!collapsed && <span className="truncate">{t(item.label)}</span>}
                  </Link>
                )
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger render={link} />
                        <TooltipContent side="left">{t(item.label)}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <CmsNavGroup collapsed={collapsed} />
      </nav>
    </aside>
  )
}
