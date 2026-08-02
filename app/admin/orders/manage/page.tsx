"use client"

import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import Image from "next/image"
import { ClipboardList, AlertTriangle, ChevronLeft, Clock, Package } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { formatNumber, formatToman } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusChip } from "@/components/orders/status-chip"
import type { AdminOrderListItem } from "@/lib/orders/shared"
import { cn } from "@/lib/utils"

type Response = { data: { orders: AdminOrderListItem[] } }

export default function AdminManageOrdersPage() {
  const [scope, setScope] = useState<"active" | "all">("active")
  const { data, isLoading } = useSWR<Response>(
    `/api/v1/admin/orders/lifecycle?scope=${scope}`,
    fetcher,
    { refreshInterval: 30_000 },
  )
  const orders = data?.data.orders ?? []
  const overdueCount = orders.filter((o) => o.overdue).length

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">مدیریت سفارش‌ها (نقشه راه)</h1>
            <p className="text-sm text-muted-foreground">
              سفارش‌های نیازمند اطلاعات، در حال انجام و در انتظار تمدید — تکمیل، تمدید یا لغو با بازگشت وجه
            </p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          {(["active", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                scope === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "active" ? "در جریان" : "همه"}
            </button>
          ))}
        </div>
      </header>

      {overdueCount > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>{formatNumber(overdueCount)} سفارش از زمان تعهد گذشته است. لطفاً هرچه زودتر تکمیل یا تمدید کنید.</p>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
          <Package className="h-8 w-8 opacity-40" />
          {scope === "active" ? "در حال حاضر سفارشی در جریان نیست." : "سفارشی یافت نشد."}
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/admin/orders/manage/${order.id}`}
                className={cn(
                  "flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40",
                  order.overdue ? "border-destructive/40" : "border-border",
                )}
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {order.coverImage ? (
                    <Image src={order.coverImage} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Package className="h-5 w-5" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate">{order.title}</strong>
                    <StatusChip status={order.status} />
                    {order.isGiveawayPrize && (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                        قرعه‌کشی
                      </span>
                    )}
                    {order.overdue && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                        <Clock className="h-3 w-3" />
                        گذشته از موعد
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {order.publicId} · {order.user.displayName || order.user.alias || order.user.email || "کاربر"}
                    {order.extensionCount > 0 && ` · ${formatNumber(order.extensionCount)} بار تمدید`}
                  </p>
                </div>
                <div className="hidden text-end sm:block">
                  <p className="font-bold">{formatToman(String(order.amount))} تومان</p>
                  <p className="text-xs text-muted-foreground">تعداد {formatNumber(order.quantity)}</p>
                </div>
                <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
