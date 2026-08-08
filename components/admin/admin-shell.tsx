"use client"

import { useEffect, useMemo, useState } from "react"
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
  Bot,
  Ticket,
  Gift,
  Share2,
  TrendingUp,
  Settings2,
  Undo2,
  Landmark,
  LifeBuoy,
  Loader2,
  Activity,
  Sparkles,
  BookOpen,
  Workflow,
  FileText,
  ClipboardList,
  ScanText,
  CircleHelp,
  Globe2,
  Server,
  HardDrive,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  Menu,
  X,
  Sun,
  Moon,
  Search,
  ChevronLeft,
  Bell,
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
  badge?: "deposits" | "withdrawals" | "deliveries" | "refunds" | "tickets" | "ops" | "questions" | "settings" | "nsRequests" | "vps"
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
      { href: "/admin/orders/manage", label: "مدیریت سفارش‌ها", icon: ClipboardList, badge: "deliveries" },
      { href: "/admin/support", label: "تیکت‌ها", icon: LifeBuoy, badge: "tickets" },
    ],
  },
  {
    title: "خدمات",
    items: [
      { href: "/admin/products", label: "محصولات", icon: Boxes, exact: true },
      { href: "/admin/product-categories", label: "دسته‌بندی فروشگاه", icon: Package },
      { href: "/admin/auctions", label: "مزایده‌ها", icon: Gavel },
      { href: "/admin/giveaways", label: "قرعه‌کشی‌ها", icon: Gift },
      { href: "/admin/domains", label: "دامنه‌ها", icon: Globe2, exact: true },
      { href: "/admin/domains/nameservers", label: "درخواست‌های NS", icon: Server, badge: "nsRequests" },
      { href: "/admin/vps", label: "سرورهای مجازی", icon: HardDrive, exact: true, badge: "vps" },
      { href: "/admin/vps/offers", label: "پلن‌های VPS", icon: Server },
    ],
  },
  {
    title: "محتوا و بازاریابی",
    items: [
      { href: "/admin/content", label: "مدیریت محتوا", icon: FileText },
      { href: "/admin/referrals", label: "سیستم دعوت", icon: Share2 },
      { href: "/admin/coupons", label: "کدهای تخفیف", icon: Ticket },
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
      { href: "/admin/ai/search-insights", label: "تحلیل جستجوها", icon: SearchCheck },
      { href: "/admin/ai/automations", label: "اتوماسیون هوشمند", icon: Workflow },
      { href: "/admin/ai/text-integrity", label: "سلامت متن فارسی", icon: ScanText },
    ],
  },
  {
    title: "سیستم",
    items: [
      { href: "/admin/users", label: "کاربران", icon: Users },
      { href: "/admin/finance", label: "مالی و حسابداری", icon: Landmark },
      { href: "/admin/settings", label: "تنظیمات", icon: Settings2, badge: "settings" },
    ],
  },
]

const items: NavItem[] = navGroups.flatMap((g) => g.items)

// Extra breadcrumb labels for nested/detail routes not present in the nav list.
const extraTitles: Record<string, string> = {
  "/admin/orders/manage": "مدیریت و تحویل سفارش‌ها",
  "/admin/settings": "تنظیمات و پیکربندی",
}

function useAdminTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    try {
      const stored = localStorage.getItem("admin-theme")
      const initial = stored === "dark" ? "dark" : "light"
      setTheme(initial)
      document.getElementById("admin-scope")?.setAttribute("data-admin-theme", initial)
    } catch {
      /* ignore */
    }
  }, [])

  function toggle() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      try {
        localStorage.setItem("admin-theme", next)
        document.getElementById("admin-scope")?.setAttribute("data-admin-theme", next)
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return { theme, toggle }
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession()
  const pathname = usePathname()
  const isAdmin = user?.role === "ADMIN"
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { theme, toggle } = useAdminTheme()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false)
    setQuery("")
  }, [pathname])

  const { data } = useSWR<{ data: Stats }>(isAdmin ? "/api/v1/admin/stats" : null, fetcher, {
    refreshInterval: 15000,
  })
  const stats = data?.data

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

  const { data: twofaData } = useSWR<{ data: unknown[] }>(
    isAdmin ? "/api/v1/admin/2fa-requests?status=PENDING" : null,
    fetcher,
    { refreshInterval: 15000 },
  )
  const pendingTwoFa = Array.isArray(twofaData?.data) ? twofaData.data.length : 0

  const { data: nsData } = useSWR<{ data: unknown[] }>(
    isAdmin ? "/api/v1/admin/domains/nameservers?scope=pending" : null,
    fetcher,
    { refreshInterval: 15000 },
  )
  const pendingNsRequests = Array.isArray(nsData?.data) ? nsData.data.length : 0

  const { data: vpsData } = useSWR<{ data: { actionable: number } }>(
    isAdmin ? "/api/v1/admin/vps/overview" : null,
    fetcher,
    { refreshInterval: 15000 },
  )
  const vpsActionable = vpsData?.data?.actionable ?? 0

  const activeItem =
    [...items].sort((a, b) => b.href.length - a.href.length).find((i) => (i.exact ? pathname === i.href : pathname.startsWith(i.href))) ?? items[0]

  function badgeCount(key?: string) {
    if (!key) return 0
    if (key === "ops") return firingAlerts
    if (key === "questions") return pendingQuestions
    if (key === "settings") return pendingTwoFa
    if (key === "nsRequests") return pendingNsRequests
    if (key === "vps") return vpsActionable
    if (!stats) return 0
    if (key === "deposits") return stats.pendingDeposits
    if (key === "withdrawals") return stats.pendingWithdrawals
    if (key === "deliveries") return stats.pendingDeliveries + stats.failedDeliveries
    if (key === "refunds") return stats.pendingRefunds
    if (key === "tickets") return stats.openTickets
    return 0
  }

  const totalAlerts = useMemo(
    () => items.reduce((n, it) => n + badgeCount(it.badge), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats, firingAlerts, pendingQuestions, pendingTwoFa, pendingNsRequests, vpsActionable],
  )

  const searchResults = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    return items.filter((i) => i.label.includes(q)).slice(0, 6)
  }, [query])

  const pageTitle = extraTitles[activeItem.href] ?? activeItem.label
  const groupOfActive = navGroups.find((g) => g.items.some((i) => i.href === activeItem.href))

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto mt-24 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h2 className="text-lg font-bold">دسترسی محدود</h2>
        <p className="text-sm text-muted-foreground">
          این بخش فقط برای مدیران در دسترس است. لطفاً با حساب مدیر وارد شوید.
        </p>
      </div>
    )
  }

  function NavLink({ item }: { item: NavItem }) {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
    const count = badgeCount(item.badge)
    const Icon = item.icon
    return (
      <Link
        href={item.href}
        className={cn(
          "group flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-primary text-primary-foreground font-semibold shadow-[0_8px_24px_-12px_var(--primary)]"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "opacity-100" : "opacity-80")} />
        <span className="truncate">{item.label}</span>
        {count > 0 && (
          <span
            className={cn(
              "mr-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums",
              active ? "bg-primary-foreground/25 text-primary-foreground" : "bg-destructive text-destructive-foreground",
            )}
          >
            {count}
          </span>
        )}
      </Link>
    )
  }

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col">
        {/* Brand */}
        <div className="mb-4 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">پنل مدیریت</div>
            <div className="truncate text-[11px] text-muted-foreground">SubIO Control Center</div>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="mr-auto grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary lg:hidden"
            aria-label="بستن منو"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto pl-1">
          <div className="flex flex-col gap-5">
            {navGroups.map((group) => {
              const groupTotal = group.items.reduce((n, it) => n + badgeCount(it.badge), 0)
              return (
                <div key={group.title}>
                  <div className="mb-1.5 flex items-center gap-2 px-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                      {group.title}
                    </span>
                    {groupTotal > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground tabular-nums">
                        {groupTotal}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <NavLink key={item.href} item={item} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </nav>

        {/* Profile footer */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-secondary/50 px-3 py-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {(user?.displayName ?? "A").slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-foreground">{user?.displayName ?? "مدیر"}</div>
            <div className="truncate text-[11px] text-muted-foreground">مدیر سیستم</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh w-full">
      {/* Desktop sidebar (floating card, right side in RTL) */}
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 p-3 lg:block">
        <div className="h-full rounded-2xl border border-border bg-card p-3 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="بستن منو"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 right-0 w-[280px] max-w-[85vw] bg-card p-3 shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 md:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground lg:hidden"
              aria-label="باز کردن منو"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Title + breadcrumb */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>پنل مدیریت</span>
                {groupOfActive && (
                  <>
                    <ChevronLeft className="h-3 w-3" />
                    <span>{groupOfActive.title}</span>
                  </>
                )}
              </div>
              <h1 className="truncate text-lg font-bold text-foreground md:text-xl">{pageTitle}</h1>
            </div>

            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی بخش‌ها..."
                className="h-10 w-44 rounded-xl border border-border bg-card pr-9 pl-3 text-sm text-foreground outline-none transition-[width,box-shadow] placeholder:text-muted-foreground focus:w-60 focus:ring-2 focus:ring-ring/40 md:w-52"
              />
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                  {searchResults.map((r) => {
                    const Icon = r.icon
                    return (
                      <Link
                        key={r.href}
                        href={r.href}
                        onClick={() => setQuery("")}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{r.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Alerts indicator */}
            <Link
              href="/admin/ops"
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-secondary"
              aria-label="اعلان‌ها"
            >
              <Bell className="h-[18px] w-[18px]" />
              {totalAlerts > 0 && (
                <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground tabular-nums">
                  {totalAlerts}
                </span>
              )}
            </Link>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggle}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-secondary"
              aria-label={theme === "dark" ? "حالت روشن" : "حالت تیره"}
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 pb-16 pt-5 md:px-6 md:pb-10">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
