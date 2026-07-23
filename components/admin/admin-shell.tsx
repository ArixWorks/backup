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
  ShieldCheck,
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
  Sparkles,
  BookOpen,
  Workflow,
  FileText,
  Send,
  ShoppingBag,
  ScanText,
  CircleHelp,
  Globe2,
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
  badge?: "deposits" | "withdrawals" | "deliveries" | "refunds" | "tickets" | "ops" | "questions" | "twofa"
}

type NavGroup = { title: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    title: "عملیات روزانه",
    items: [
      { href: "/admin", label: "داشبورد", icon: LayoutDashboard, exact: true },
      { href: "/admin/ops", label: "مرکز عملیات", icon: Activity, badge: "ops" },
      { href: "/admin/deposits", label: "تأیید واریز", icon: Banknote, badge: "deposits" },
      { href: "/admin/withdrawals", label: "برداشت‌ها", icon: ArrowDownToLine, badge: "withdrawals" },
      { href: "/admin/refunds", label: "بازگشت وجه", icon: Undo2, badge: "refunds" },
      { href: "/admin/deliveries", label: "تحویل سفارش", icon: Package, badge: "deliveries" },
      { href: "/admin/two-factor", label: "درخواست‌های ۲FA", icon: ShieldCheck, badge: "twofa" },
      { href: "/admin/orders", label: "خریدهای آزمایشی", icon: ShoppingBag },
      { href: "/admin/support", label: "تیکت‌ها", icon: LifeBuoy, badge: "tickets" },
    ],
  },
  {
    title: "خدمات",
    items: [
      { href: "/admin/products", label: "محصولات", icon: Boxes },
      { href: "/admin/auctions", label: "مزایده‌ها", icon: Gavel },
      { href: "/admin/giveaways", label: "قرعه‌کشی‌ها", icon: Gift },
      { href: "/admin/domains", label: "دامنه‌ها", icon: Globe2 },
    ],
  },
  {
    title: "محتوا",
    items: [{ href: "/admin/content", label: "مدیریت محتوا", icon: FileText }],
  },
  {
    title: "بازاریابی",
    items: [
      { href: "/admin/referrals", label: "سیستم دعوت", icon: Share2 },
      { href: "/admin/coupons", label: "کدهای تخفیف", icon: Ticket },
      { href: "/admin/broadcasts", label: "مرکز پیام", icon: Megaphone },
      { href: "/admin/channel", label: "پست کانال", icon: Send },
      { href: "/admin/email", label: "مدیریت ایمیل", icon: Mail },
      { href: "/admin/growth", label: "تحلیل رشد", icon: TrendingUp },
    ],
  },
  {
    title: "هوش مصنوعی",
    items: [
      { href: "/admin/ai", label: "دستیار هوشمند", icon: Sparkles, exact: true },
      { href: "/admin/ai/questions", label: "پرسش‌های محصول", icon: CircleHelp, badge: "questions" },
      { href: "/admin/ai/copilot", label: "کوپایلت فرم‌ها", icon: Bot },
      { href: "/admin/ai/knowledge", label: "پایگاه دانش", icon: BookOpen },
      { href: "/admin/ai/automations", label: "اتوماسیون هوشمند", icon: Workflow },
      { href: "/admin/ai/text-integrity", label: "سلامت متن فارسی", icon: ScanText },
    ],
  },
  {
    title: "سیستم",
    items: [
      { href: "/admin/users", label: "کاربران", icon: Users },
      { href: "/admin/finance", label: "مالی و حسابداری", icon: Landmark },
      { href: "/admin/bot", label: "ربات تلگرام", icon: Bot },
      { href: "/admin/settings", label: "تنظیمات پاداش", icon: Settings2 },
      { href: "/admin/backup", label: "پشتیبان‌گیری", icon: DatabaseBackup },
      { href: "/admin/audit", label: "گزارش فعالیت", icon: ScrollText },
    ],
  },
]

const items: NavItem[] = navGroups.flatMap((g) => g.items)

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

  const { data: questionData } = useSWR<{ data: { pending: number } }>(
    isAdmin ? "/api/v1/admin/ai/questions?summary=1" : null,
    fetcher,
    { refreshInterval: 15000 },
  )
  const pendingQuestions = questionData?.data?.pending ?? 0

  // Pending 2FA re-requests, for the sidebar badge.
  const { data: twofaData } = useSWR<unknown[]>(
    isAdmin ? "/api/v1/admin/2fa-requests?status=PENDING" : null,
    fetcher,
    { refreshInterval: 15000 },
  )
  const pendingTwoFa = Array.isArray(twofaData) ? twofaData.length : 0

  const activeItem =
    items.find((i) => (i.exact ? pathname === i.href : pathname.startsWith(i.href))) ?? items[0]

  function badgeCount(key?: string) {
    if (!key) return 0
    if (key === "ops") return firingAlerts
    if (key === "questions") return pendingQuestions
    if (key === "twofa") return pendingTwoFa
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

  function GroupSum({ group }: { group: NavGroup }) {
    const total = group.items.reduce((n, it) => n + badgeCount(it.badge), 0)
    if (total === 0) return null
    return (
      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground tabular-nums">
        {total}
      </span>
    )
  }

  function NavSections({ grid = false }: { grid?: boolean }) {
    return (
      <div className="flex flex-col gap-3">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="mb-1 flex items-center gap-2 px-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">
                {group.title}
              </span>
              <GroupSum group={group} />
            </div>
            <div className={cn(grid ? "grid grid-cols-2 gap-1" : "flex flex-col gap-1")}>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
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
          <nav className="glass mt-2 rounded-xl border border-border/60 p-2 shadow-lg">
            <NavSections grid />
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
          <nav className="max-h-[calc(100dvh-9rem)] overflow-y-auto pl-1">
            <NavSections />
          </nav>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  )
}
