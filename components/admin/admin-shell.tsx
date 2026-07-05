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
  Share2,
  TrendingUp,
  Settings2,
  Undo2,
  Landmark,
  LifeBuoy,
  Loader2,
  ChevronDown,
  Activity,
  DatabaseBackup,
  Mail,
} from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"
import { LivingSurface } from "@/components/living-surface"

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
  badge?: "deposits" | "withdrawals" | "deliveries" | "refunds" | "tickets" | "ops"
}

const items: NavItem[] = [
  { href: "/admin", label: "داشبورد", icon: LayoutDashboard, exact: true },
  { href: "/admin/ops", label: "مرکز عملیات", icon: Activity, badge: "ops" },
  { href: "/admin/growth", label: "تحلیل رشد", icon: TrendingUp },
  { href: "/admin/deposits", label: "تأیید واریز", icon: Banknote, badge: "deposits" },
  { href: "/admin/withdrawals", label: "برداشت‌ها", icon: ArrowDownToLine, badge: "withdrawals" },
  { href: "/admin/refunds", label: "بازگشت وجه", icon: Undo2, badge: "refunds" },
  { href: "/admin/finance", label: "مالی و حسابداری", icon: Landmark },
  { href: "/admin/support", label: "تیکت‌ها", icon: LifeBuoy, badge: "tickets" },
  { href: "/admin/deliveries", label: "تحویل سفارش", icon: Package, badge: "deliveries" },
  { href: "/admin/products", label: "محصولات", icon: Boxes },
  { href: "/admin/auctions", label: "مزایده‌ها", icon: Gavel },
  { href: "/admin/giveaways", label: "قرعه‌کشی‌ها", icon: Gift },
  { href: "/admin/referrals", label: "سیستم دعوت", icon: Share2 },
  { href: "/admin/coupons", label: "کدهای تخفیف", icon: Ticket },
  { href: "/admin/users", label: "کاربران", icon: Users },
  { href: "/admin/channel", label: "پست کانال", icon: Megaphone },
  { href: "/admin/bot", label: "ربات تلگرام", icon: Bot },
  { href: "/admin/settings", label: "تنظیمات پاداش", icon: Settings2 },
  { href: "/admin/email", label: "مدیریت ایمیل", icon: Mail },
  { href: "/admin/backup", label: "پشتیبان‌گیری", icon: DatabaseBackup },
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

  // Live count of firing alerts, shown as a badge on the Operations Center link.
  const { data: opsData } = useSWR<{ data: { firing: number } }>(
    isAdmin ? "/api/v1/admin/ops/alerts?limit=1" : null,
    fetcher,
    { refreshInterval: 15000 },
  )
  const firingAlerts = opsData?.data?.firing ?? 0

  const activeItem =
    items.find((i) => (i.exact ? pathname === i.href : pathname.startsWith(i.href))) ?? items[0]

  function badgeCount(key?: string) {
    if (!key) return 0
    if (key === "ops") return firingAlerts
    if (!stats) return 0
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
    <div className="relative mx-auto grid w-full max-w-5xl gap-4 px-4 pb-16 pt-4 md:grid-cols-[220px_1fr] md:gap-6 md:px-6 md:pb-10 md:pt-6">
      {/* Subtle live ambient particles — professional, minimal distraction. */}
      <LivingSurface intensity="soft" lines={false} className="fixed inset-0 -z-10" />

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
          className="glass flex w-full items-center gap-2 rounded-xl border border-border/60 px-4 py-3 text-sm font-semibold shadow-md"
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
          <nav className="glass mt-2 grid grid-cols-2 gap-1 rounded-xl border border-border/60 p-2 shadow-lg">
            {items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
        )}
      </div>

      {/* Desktop: sticky glass sidebar */}
      <aside className="hidden md:sticky md:top-20 md:block md:self-start">
        <div className="glass rounded-2xl border border-border/60 p-2.5 shadow-lg">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <span className="font-bold">پنل مدیریت</span>
          </div>
          <nav className="flex flex-col gap-1">
            {items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  )
}
