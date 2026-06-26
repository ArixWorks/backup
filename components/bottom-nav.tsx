"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"
import { Home, Gavel, Zap, Wallet, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

const tabs: { href: string; label: MessageKey; icon: typeof Home }[] = [
  { href: "/", label: "nav.home", icon: Home },
  { href: "/auctions", label: "nav.auctions", icon: Gavel },
  { href: "/flash", label: "nav.flash", icon: Zap },
  { href: "/wallet", label: "nav.wallet", icon: Wallet },
  { href: "/orders", label: "nav.orders", icon: Package },
]

export function BottomNav() {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="fixed inset-x-0 bottom-0 z-50 px-safe pb-safe"
    >
      <ul className="glass elevate-lg mx-auto mb-2 flex max-w-md items-stretch justify-between gap-1 rounded-[1.4rem] border border-primary/15 px-2 py-1.5">
        {tabs.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="group flex flex-col items-center gap-1 rounded-xl px-1 py-1.5"
              >
                <span className="relative flex h-8 w-12 items-center justify-center">
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-primary/20 ring-1 ring-primary/40 shadow-[0_0_18px_-4px_var(--primary)]"
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    />
                  )}
                  <motion.span
                    animate={{ scale: active ? 1.12 : 1, y: active ? -1 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    className={cn(
                      "relative z-[1] transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-active:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
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
