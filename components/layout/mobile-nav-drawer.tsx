"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { sidebarGroups, isNavItemActive } from "@/lib/nav-config"
import { Logo } from "@/components/logo"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

/**
 * Mobile-only navigation drawer (hamburger → slide-in panel from the start
 * edge). Gives phones access to the full nav tree — including secondary items
 * that don't fit in the 5-slot bottom tab bar — without cluttering the compact
 * header. Hidden on `lg+` where the persistent Sidebar takes over. The trigger
 * lives in the header; closing on navigation is handled by DrawerClose wrapping
 * each link.
 */
export function MobileNavDrawer() {
  const pathname = usePathname() ?? "/"
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        aria-label={t("a11y.openMenu")}
        className="tap-target grid place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
      >
        <Menu className="size-5" />
      </DrawerTrigger>
      <DrawerContent side="start">
        <DrawerHeader>
          <DrawerTitle className="sr-only">{t("a11y.mainNav")}</DrawerTitle>
          <Logo />
        </DrawerHeader>
        <DrawerBody>
          <nav aria-label={t("a11y.mainNav")}>
            {sidebarGroups.map((group, gi) => (
              <div key={gi} className="mb-5 last:mb-0">
                <p className="px-2 pb-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground/70">
                  {t(group.title)}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = isNavItemActive(item, pathname)
                    const Icon = item.icon
                    return (
                      <li key={item.href}>
                        <DrawerClose
                          render={
                            <Link
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-3 text-fluid-sm font-medium transition-colors",
                                active
                                  ? "bg-primary/12 text-primary"
                                  : "text-foreground hover:bg-muted",
                              )}
                            >
                              <Icon className={cn("size-5 shrink-0", active && "text-primary")} />
                              <span className="truncate">{t(item.label)}</span>
                            </Link>
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
