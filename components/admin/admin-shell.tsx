"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import {
  LayoutDashboard,
  Banknote,
  ArrowDownToLine,
  Package,
  Boxes,
  Gavel,
  Users,
  ScrollText,
  ShieldAlert,
  Bot,
  Megaphone,
  Ticket,
  Gift,
  Settings2,
  Undo2,
  LifeBuoy,
  Loader2,
  ChevronDown,
} from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"

type Stats = {
  pendingDeposits: number
  pendingWithdrawals: number
  pendingDeliveries: number
  failedDeliveries: number
  pendingRefunds: number
  openTickets: number
}

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  badge?: "deposits" | "withdrawals" | "deliveries" | "refunds" | "tickets"
}

const items: NavItem[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard, exact: true },
  { href: "/admin/deposits", label: "تأیید واریز", icon: Banknote, badge: "deposits" },
  { href: "/admin/withdrawals", label: "برداشت‌ها", icon: ArrowDownToLine, badge: "withdrawals" },
  { href: "/admin/refunds", label: "بازگشت وجه", icon: Undo2, badge: "refunds" },
  { href: "/admin/support", label: "تیکت‌ها", icon: LifeBuoy, badge: "tickets" },
  { href: "/admin/deliveries", label: "تحویل سفارش", icon: Package, badge: "deliveries" },
  { href: "/admin/products", label: "محصولات", icon: Boxes },
  { href: "/admin/auctions", label: "مزایده‌ها", icon: Gavel },
  { href: "/admin/giveaways", label: "قرعه‌کشی‌ها", icon: Gift },
  { href: "/admin/coupons", label: "کدهای تخفیف", icon: Ticket },
  { href: "/admin/users", label: "کاربران", icon: Users },
  { href: "/admin/channel", label: "پست کانال", icon: Megaphone },
  { href: "/admin/bot", label: "ربات تلگرام", icon: Bot },
  { href: "/admin/settings", label: "تنظیمات پاداش", icon: Settings2 },
  { href: "/admin/audit", label: "گزارش فعالیت", icon: ScrollText },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession()
  const pathname = usePathname()
  const isAdmin = user?.role === "ADMIN"
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the mobile section menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const { data } = useSWR<{ data: Stats }>(isAdmin ? "/api/v1/admin/stats" : null, fetcher, {
    refreshInterval: 15000,
  })
  const stats = data?.data

  const activeItem =
    items.find((i) => (i.exact ? pathname === i.href : pathname.startsWith(i.href))) ?? items[0]

  function badgeCount(key?: string) {
    if (!stats || !key) return 0
    if (key === "deposits") return stats.pendingDeposits
    if (key === "withdrawals") return stats.pendingWithdrawals
    if (key === "deliveries") return stats.pendingDeliveries + stats.failedDeliveries
    if (key === "refunds") return stats.pendingRefunds
    if (key === "tickets") return stats.openTickets
    return 0
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h2 className="text-lg font-bold">دسترسی محدود</h2>
        <p className="text-sm text-muted-foreground">
          این بخش فقط برای مدیران در دسترس است. لطفاً از منوی بالا با حساب مدیر وارد شوید.
        </p>
      </div>
    )
  }

  const ActiveIcon = activeItem.icon

  function NavLink({ item }: { item: NavItem }) {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
    const count = badgeCount(item.badge)
    const Icon = item.icon
    return (
      <Link
        href={item.href}
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-primary/10 font-semibold text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        {count > 0 && (
          <span className="mr-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground tabular-nums">
            {count}
          </span>
        )}
      </Link>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-16 pt-4 md:grid-cols-[220px_1fr] md:gap-6 md:px-6 md:pb-10 md:pt-6">
      {/* Mobile: compact section switcher (avoids horizontal overflow in Telegram) */}
      <div className="md:hidden">
        <div className="mb-3 flex items-center gap-2 px-1">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <span className="font-bold">پنل مدیریت</span>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm font-semibold"
        >
          <ActiveIcon className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{activeItem.label}</span>
          <ChevronDown
            className={cn(
              "mr-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              menuOpen && "rotate-180",
            )}
          />
        </button>
        {menuOpen && (
          <nav className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-border bg-card p-2">
            {items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
        )}
      </div>

      {/* Desktop: sticky sidebar */}
      <aside className="hidden md:sticky md:top-20 md:block md:self-start">
        <div className="mb-3 flex items-center gap-2 px-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <span className="font-bold">پنل مدیریت</span>
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  )
}
