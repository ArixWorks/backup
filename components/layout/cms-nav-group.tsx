"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { cn } from "@/lib/utils"
import { fetcher } from "@/lib/api-client"
import { resolveCmsIcon } from "@/lib/cms/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useI18n } from "@/components/i18n-provider"

type NavNode = { id: string; label: string; href: string | null; icon: string | null; children: NavNode[] }

/**
 * CMS-driven navigation group for the web sidebar. Published content flagged
 * "show in menu" (placement SIDEBAR) appears here automatically — no code
 * change needed to add a new link. Renders nothing until there is content.
 */
export function CmsNavGroup({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname() ?? "/"
  const { locale, t } = useI18n()
  const { data } = useSWR<{ data: { tree: NavNode[] } }>(`/api/v1/nav?placement=SIDEBAR&locale=${locale}`, fetcher, {
    revalidateOnFocus: false,
  })
  const items = data?.data?.tree ?? []
  if (items.length === 0) return null

  return (
    <div className="mb-4 last:mb-0">
      {!collapsed && (
        <p className="px-3 pb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground/70">
          {t("cms.navigationTitle")}
        </p>
      )}
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const href = item.href ?? "#"
          const active = pathname === href || pathname.startsWith(href + "/")
          const Icon = resolveCmsIcon(item.icon ?? "FileText")
          const link = (
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-fluid-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5 shrink-0", active && "text-primary")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
          return (
            <li key={item.id}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger render={link} />
                  <TooltipContent side="left">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
