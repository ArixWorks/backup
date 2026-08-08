"use client"

import useSWR from "swr"
import Link from "next/link"
import { Server, Boxes, Clock, CheckCircle2, Wrench, Plus, LayoutList } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { formatNumber } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Overview = {
  totalOffers: number
  activeOffers: number
  pendingOrders: number
  processingOrders: number
  readyOrders: number
  completedOrders: number
  activeInstances: number
  openRequests: number
  actionable: number
}

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  icon: typeof Server
  accent?: string
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground", accent)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold tabular-nums leading-tight">{formatNumber(value)}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  )
}

export default function AdminVpsOverviewPage() {
  const { data } = useSWR<{ ok: boolean; data: Overview }>("/api/v1/admin/vps/overview", fetcher, {
    refreshInterval: 15000,
  })
  const s = data?.data

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Server className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">سرورهای مجازی</h1>
            <p className="text-sm text-muted-foreground">مدیریت پلن‌ها، سفارش‌ها و سرورهای فعال</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/vps/offers" className={cn(buttonVariants({ variant: "secondary" }), "gap-2")}>
            <LayoutList className="h-4 w-4" />
            پلن‌ها
          </Link>
          <Link href="/admin/vps/offers/new" className={cn(buttonVariants(), "gap-2")}>
            <Plus className="h-4 w-4" />
            پلن جدید
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="پلن‌های فعال" value={s?.activeOffers ?? 0} icon={Boxes} accent="bg-primary/10 text-primary" />
        <Stat label="در انتظار پرداخت" value={s?.pendingOrders ?? 0} icon={Clock} />
        <Stat label="در حال پردازش" value={s?.processingOrders ?? 0} icon={Wrench} accent="bg-chart-4/10 text-chart-4" />
        <Stat label="آماده تحویل" value={s?.readyOrders ?? 0} icon={Clock} accent="bg-chart-1/10 text-chart-1" />
        <Stat label="تکمیل‌شده" value={s?.completedOrders ?? 0} icon={CheckCircle2} accent="bg-chart-2/10 text-chart-2" />
        <Stat label="سرورهای فعال" value={s?.activeInstances ?? 0} icon={Server} accent="bg-primary/10 text-primary" />
        <Stat label="درخواست‌های باز" value={s?.openRequests ?? 0} icon={Wrench} accent="bg-destructive/10 text-destructive" />
        <Stat label="کل پلن‌ها" value={s?.totalOffers ?? 0} icon={LayoutList} />
      </div>

      {s && s.totalOffers === 0 && (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Server className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">هنوز پلنی ندارید</p>
            <p className="text-sm text-muted-foreground">برای شروع فروش VPS، اولین پلن را بسازید.</p>
          </div>
          <Link href="/admin/vps/offers/new" className={cn(buttonVariants(), "mt-1 gap-2")}>
            <Plus className="h-4 w-4" />
            ساخت اولین پلن
          </Link>
        </Card>
      )}

      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          صف سفارش‌ها و درخواست‌های خدمات در فازهای بعدی به این بخش اضافه می‌شوند.
        </p>
      </Card>
    </div>
  )
}
