"use client"

import Link from "next/link"
import useSWR from "swr"
import {
  Users,
  Gavel,
  Banknote,
  ArrowDownToLine,
  Package,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Lock,
} from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { formatToman, formatNumber, formatRelative } from "@/lib/format"
import { StatusPill } from "@/components/admin/status-pill"
import { Skeleton } from "@/components/ui/skeleton"

type Stats = {
  userCount: number
  activeAuctions: number
  pendingDeposits: number
  pendingWithdrawals: number
  pendingDeliveries: number
  failedDeliveries: number
  totalBalance: number
  frozenBalance: number
  revenue: number
  recentOrders: {
    id: string
    type: string
    status: string
    amount: number
    createdAt: string
    user: { displayName: string; alias: string }
    product: { title: string }
  }[]
}

const orderTypeLabels: Record<string, string> = {
  FIXED_PURCHASE: "خرید فوری",
  BUY_NOW: "خرید فوری مزایده",
  AUCTION_WIN: "برنده مزایده",
}

export default function AdminDashboard() {
  const { data, isLoading } = useSWR<{ data: Stats }>("/api/v1/admin/stats", fetcher, {
    refreshInterval: 15000,
  })
  const s = data?.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">داشبورد مدیریت</h1>
        <p className="text-sm text-muted-foreground">نمای کلی وضعیت سامانه و کارهای در انتظار</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="درآمد کل"
          value={s ? `${formatToman(s.revenue)} ت` : undefined}
          icon={<TrendingUp className="h-5 w-5" />}
          accent
          loading={isLoading}
        />
        <Kpi
          label="موجودی کل کاربران"
          value={s ? `${formatToman(s.totalBalance)} ت` : undefined}
          icon={<Wallet className="h-5 w-5" />}
          loading={isLoading}
        />
        <Kpi
          label="وجوه مسدودشده"
          value={s ? `${formatToman(s.frozenBalance)} ت` : undefined}
          icon={<Lock className="h-5 w-5" />}
          loading={isLoading}
        />
        <Kpi
          label="کاربران"
          value={s ? formatNumber(s.userCount) : undefined}
          icon={<Users className="h-5 w-5" />}
          loading={isLoading}
        />
      </div>

      {/* Action queue */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          href="/admin/deposits"
          label="واریز در انتظار"
          count={s?.pendingDeposits}
          icon={<Banknote className="h-5 w-5" />}
          loading={isLoading}
        />
        <ActionCard
          href="/admin/withdrawals"
          label="برداشت در انتظار"
          count={s?.pendingWithdrawals}
          icon={<ArrowDownToLine className="h-5 w-5" />}
          loading={isLoading}
        />
        <ActionCard
          href="/admin/deliveries"
          label="تحویل در انتظار"
          count={s?.pendingDeliveries}
          icon={<Package className="h-5 w-5" />}
          loading={isLoading}
        />
        <ActionCard
          href="/admin/deliveries"
          label="تحویل ناموفق"
          count={s?.failedDeliveries}
          icon={<AlertTriangle className="h-5 w-5" />}
          danger
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gavel className="h-4 w-4" />
            مزایده‌های فعال
          </div>
          {isLoading ? (
            <Skeleton className="mt-2 h-9 w-16" />
          ) : (
            <div className="mt-1 text-3xl font-extrabold tabular-nums">
              {formatNumber(s?.activeAuctions ?? 0)}
            </div>
          )}
          <Link
            href="/admin/auctions"
            className="mt-3 inline-block text-xs text-primary hover:underline"
          >
            مدیریت مزایده‌ها ←
          </Link>
        </div>

        {/* Recent orders */}
        <div className="rounded-xl border border-border bg-card lg:col-span-2">
          <div className="border-b border-border px-4 py-3 font-bold">آخرین سفارش‌ها</div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : s && s.recentOrders.length > 0 ? (
            <ul className="divide-y divide-border">
              {s.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{o.product.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {o.user.displayName} · {orderTypeLabels[o.type] ?? o.type} ·{" "}
                      {formatRelative(o.createdAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={o.status} />
                    <span className="tabular-nums text-sm font-bold">{formatToman(o.amount)} ت</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">سفارشی ثبت نشده است.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  icon,
  accent,
  loading,
}: {
  label: string
  value?: string
  icon: React.ReactNode
  accent?: boolean
  loading: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
    >
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs">{label}</span>
        <span className={accent ? "text-primary" : ""}>{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <div className={`mt-1 text-xl font-extrabold tabular-nums ${accent ? "text-primary" : ""}`}>
          {value}
        </div>
      )}
    </div>
  )
}

function ActionCard({
  href,
  label,
  count,
  icon,
  danger,
  loading,
}: {
  href: string
  label: string
  count?: number
  icon: React.ReactNode
  danger?: boolean
  loading: boolean
}) {
  const has = (count ?? 0) > 0
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-xl border p-4 transition-colors hover:border-primary/40 ${
        has && danger
          ? "border-destructive/40 bg-destructive/5"
          : has
            ? "border-warning/40 bg-warning/5"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            has && danger
              ? "bg-destructive/15 text-destructive"
              : has
                ? "bg-warning/15 text-warning"
                : "bg-secondary text-muted-foreground"
          }`}
        >
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-8" />
      ) : (
        <span className="text-2xl font-extrabold tabular-nums">{formatNumber(count ?? 0)}</span>
      )}
    </Link>
  )
}
