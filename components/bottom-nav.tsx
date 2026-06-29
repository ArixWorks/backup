"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"
import { House, Gavel, Zap, Wallet, ShoppingBag } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

const tabs: { href: string; label: MessageKey; icon: typeof House }[] = [
  { href: "/", label: "nav.home", icon: House },
  { href: "/auctions", label: "nav.auctions", icon: Gavel },
  { href: "/flash", label: "nav.flash", icon: Zap },
  { href: "/wallet", label: "nav.wallet", icon: Wallet },
  { href: "/orders", label: "nav.orders", icon: ShoppingBag },
]

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <nav
      aria-label={t("a11y.mainNav")}
      className={cn(
        // Flush to the very bottom edge, full width, fully opaque so page
        // content can never bleed through and become unreadable. The safe-area
        // padding lives INSIDE the bar so its solid background fills all the way
        // down to the device edge with no gap.
        "fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-card pb-safe px-safe",
        "shadow-[0_-10px_30px_-16px_rgba(0,0,0,0.7)]",
      )}
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-between gap-1 px-2 pt-1.5 pb-1">
        {tabs.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="group relative flex flex-col items-center gap-1 rounded-xl px-1 pt-2 pb-1"
              >
                {/* Modern top accent that slides between active tabs. */}
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary shadow-[0_0_10px_-1px_var(--primary)]"
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  />
                )}
                <span className="relative flex h-9 w-12 items-center justify-center">
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-2xl bg-primary/15 ring-1 ring-primary/30"
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    />
                  )}
                  <motion.span
                    animate={{ scale: active ? 1.1 : 1, y: active ? -1 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    className={cn(
                      "relative z-[1] transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-active:text-foreground",
                    )}
                  >
                    <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.9} />
                  </motion.span>
                </span>
                <span
                  className={cn(
                    "text-[11px] font-medium leading-none transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {t(tab.label)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
