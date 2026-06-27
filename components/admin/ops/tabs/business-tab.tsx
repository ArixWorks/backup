"use client"

import { ShoppingCart, Banknote, Wallet, Users, Gift, Gavel, Share2, Crown } from "lucide-react"
import { KpiCard } from "../kpi-card"
import { MetricChart } from "../metric-chart"
import { useOpsData } from "../use-ops-data"
import { formatNumber, formatToman } from "@/lib/format"

type Business = {
  ordersPerMin: number
  revenueWindow: number
  walletTxPerMin: number
  activeUsers: number
  giveawayActivity: number
  auctionActivity: number
  referralConversions: number
  vipMembers: number
}
type BizResp = {
  current: Business
  series: Record<string, { t: string; value: number }[]>
}

export function BusinessTab({ range }: { range: string }) {
  const { data, isLoading } = useOpsData<BizResp>(`/api/v1/admin/ops/business?range=${range}`, {
    on: ["metrics", "activity"],
    refreshInterval: 15000,
  })
  const b = data?.current

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="سفارش در دقیقه" value={b ? formatNumber(b.ordersPerMin) : undefined} icon={<ShoppingCart className="size-5" />} loading={isLoading} severity="ok" />
        <KpiCard label="درآمد (بازه)" value={b ? formatToman(b.revenueWindow) : undefined} icon={<Banknote className="size-5" />} loading={isLoading} />
        <KpiCard label="تراکنش کیف‌پول/دقیقه" value={b ? formatNumber(b.walletTxPerMin) : undefined} icon={<Wallet className="size-5" />} loading={isLoading} />
        <KpiCard label="کاربران فعال" value={b ? formatNumber(b.activeUsers) : undefined} icon={<Users className="size-5" />} loading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
          <div className="mb-3 text-sm font-bold">روند درآمد</div>
          <MetricChart
            loading={isLoading}
            series={data?.series ?? {}}
            defs={[{ key: "biz.revenue_window", label: "درآمد", color: "var(--chart-2)", unit: "toman" }]}
            kind="area"
            height={240}
          />
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
          <div className="mb-3 text-sm font-bold">سفارش‌ها و تراکنش‌ها</div>
          <MetricChart
            loading={isLoading}
            series={data?.series ?? {}}
            defs={[
              { key: "biz.orders_per_min", label: "سفارش/دقیقه", color: "var(--chart-3)", unit: "count" },
              { key: "biz.wallet_tx_per_min", label: "تراکنش/دقیقه", color: "var(--chart-1)", unit: "count" },
            ]}
            kind="bar"
            height={240}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="فعالیت قرعه‌کشی" value={b ? formatNumber(b.giveawayActivity) : undefined} icon={<Gift className="size-4" />} loading={isLoading} />
        <KpiCard label="فعالیت مزایده" value={b ? formatNumber(b.auctionActivity) : undefined} icon={<Gavel className="size-4" />} loading={isLoading} />
        <KpiCard label="تبدیل دعوت" value={b ? formatNumber(b.referralConversions) : undefined} icon={<Share2 className="size-4" />} loading={isLoading} />
        <KpiCard label="اعضای ویژه (VIP)" value={b ? formatNumber(b.vipMembers) : undefined} icon={<Crown className="size-4" />} loading={isLoading} />
      </div>
    </div>
  )
}
