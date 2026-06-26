"use client"

import useSWR from "swr"
import {
  TrendingUp,
  Users,
  UserCheck,
  Share2,
  BellRing,
  Crown,
  Repeat,
  Sparkles,
} from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { formatNumber } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"

type Growth = {
  referral: {
    totalReferred: number
    joined: number
    converted: number
    conversionRate: number
    pointsAwarded: number
  }
  engagement: {
    dau: number
    activeLast7: number
    activeLast30: number
    returningRate: number
    avgLoginStreak: number
  }
  notifications: { total: number; read: number; openRate: number; last7: number }
  loyalty: {
    totalPointsInCirculation: number
    vipMembers: number
    tierDistribution: { tier: string; label: string; count: number }[]
    newVipLast30: number
  }
  signupTrend: { date: string; count: number }[]
}

export default function GrowthAnalyticsPage() {
  const { data, isLoading } = useSWR<{ data: Growth }>("/api/v1/admin/growth", fetcher, {
    refreshInterval: 30000,
  })
  const g = data?.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">تحلیل رشد</h1>
        <p className="text-sm text-muted-foreground">
          عملکرد سیستم دعوت، تعامل کاربران، اعلان‌ها و باشگاه مشتریان
        </p>
      </div>

      {/* Top KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="کاربران فعال امروز"
          value={g ? formatNumber(g.engagement.dau) : undefined}
          icon={<Users className="h-5 w-5" />}
          accent
          loading={isLoading}
        />
        <Kpi
          label="نرخ تبدیل دعوت"
          value={g ? `${g.referral.conversionRate}٪` : undefined}
          icon={<Share2 className="h-5 w-5" />}
          loading={isLoading}
        />
        <Kpi
          label="نرخ بازگشت کاربران"
          value={g ? `${g.engagement.returningRate}٪` : undefined}
          icon={<Repeat className="h-5 w-5" />}
          loading={isLoading}
        />
        <Kpi
          label="نرخ بازکردن اعلان‌ها"
          value={g ? `${g.notifications.openRate}٪` : undefined}
          icon={<BellRing className="h-5 w-5" />}
          loading={isLoading}
        />
      </div>

      {/* Signup trend chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold">
          <TrendingUp className="h-4 w-4 text-primary" />
          ثبت‌نام‌های ۱۴ روز اخیر
        </div>
        {isLoading || !g ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : (
          <TrendChart data={g.signupTrend} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Referral funnel */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold">
            <Share2 className="h-4 w-4 text-primary" />
            قیف دعوت
          </div>
          {isLoading || !g ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : (
            <div className="space-y-3">
              <FunnelStep
                label="دعوت‌شده"
                value={g.referral.totalReferred}
                max={g.referral.totalReferred}
              />
              <FunnelStep
                label="عضو شده (مرحله ۱)"
                value={g.referral.joined}
                max={g.referral.totalReferred}
              />
              <FunnelStep
                label="اولین خرید (مرحله ۲)"
                value={g.referral.converted}
                max={g.referral.totalReferred}
                accent
              />
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">امتیاز پرداخت‌شده بابت دعوت</span>
                <span className="font-bold tabular-nums">
                  {formatNumber(g.referral.pointsAwarded)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* VIP distribution */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold">
            <Crown className="h-4 w-4 text-primary" />
            توزیع سطوح عضویت
          </div>
          {isLoading || !g ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : (
            <div className="space-y-3">
              {g.loyalty.tierDistribution.map((t) => {
                const total = g.loyalty.tierDistribution.reduce((s, x) => s + x.count, 0)
                return <FunnelStep key={t.tier} label={t.label} value={t.count} max={total} />
              })}
              <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">اعضای VIP جدید (۳۰ روز)</span>
                <span className="font-bold tabular-nums">
                  {formatNumber(g.loyalty.newVipLast30)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Secondary KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat
          label="فعال ۷ روز اخیر"
          value={g ? formatNumber(g.engagement.activeLast7) : undefined}
          icon={<UserCheck className="h-4 w-4" />}
          loading={isLoading}
        />
        <MiniStat
          label="فعال ۳۰ روز اخیر"
          value={g ? formatNumber(g.engagement.activeLast30) : undefined}
          icon={<UserCheck className="h-4 w-4" />}
          loading={isLoading}
        />
        <MiniStat
          label="امتیاز در گردش"
          value={g ? formatNumber(g.loyalty.totalPointsInCirculation) : undefined}
          icon={<Sparkles className="h-4 w-4" />}
          loading={isLoading}
        />
        <MiniStat
          label="اعضای ویژه (VIP)"
          value={g ? formatNumber(g.loyalty.vipMembers) : undefined}
          icon={<Crown className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>
    </div>
  )
}

function TrendChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div className="flex h-40 items-end justify-between gap-1.5">
      {data.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
              title={`${d.count}`}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {d.date.slice(8)}
          </span>
        </div>
      ))}
    </div>
  )
}

function FunnelStep({
  label,
  value,
  max,
  accent,
}: {
  label: string
  value: number
  max: number
  accent?: boolean
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums">{formatNumber(value)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${accent ? "bg-primary" : "bg-primary/50"}`}
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
        />
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
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <div className={`mt-1 text-2xl font-extrabold tabular-nums ${accent ? "text-primary" : ""}`}>
          {value}
        </div>
      )}
    </div>
  )
}

function MiniStat({
  label,
  value,
  icon,
  loading,
}: {
  label: string
  value?: string
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-6 w-20" />
      ) : (
        <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
      )}
    </div>
  )
}
