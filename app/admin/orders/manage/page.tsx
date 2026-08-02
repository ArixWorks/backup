"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import Image from "next/image"
import { AlertTriangle, ChevronLeft, ClipboardList, Clock, Globe, Package, Search } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { formatNumber, formatToman } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusChip } from "@/components/orders/status-chip"
import { FulfillmentBadge } from "@/components/admin/fulfillment-badge"
import type { AdminDomainOrderListItem, AdminOrderListItem } from "@/lib/orders/shared"
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value"
import { cn } from "@/lib/utils"

type Scope = "active" | "all"
type Category = "ALL" | "SHOP" | "AUCTION" | "DOMAIN"

const CATEGORY_TABS: { key: Category; label: string }[] = [
  { key: "ALL", label: "همه" },
  { key: "SHOP", label: "فروشگاه" },
  { key: "AUCTION", label: "مزایده" },
  { key: "DOMAIN", label: "دامنه" },
]

export default function AdminManageOrdersPage() {
  const [scope, setScope] = useState<Scope>("active")
  const [category, setCategory] = useState<Category>("ALL")
  const [query, setQuery] = useState("")
  const q = useDebouncedValue(query.trim(), 300)

  // Shop/auction orders (skipped when the DOMAIN tab is active).
  const shopKey =
    category === "DOMAIN"
      ? null
      : `/api/v1/admin/orders/lifecycle?scope=${scope}` +
        (category === "SHOP" || category === "AUCTION" ? `&category=${category}` : "") +
        (q ? `&q=${encodeURIComponent(q)}` : "")
  const { data: shopData, isLoading: shopLoading } = useSWR<{ data: { orders: AdminOrderListItem[] } }>(
    shopKey,
    fetcher,
    { refreshInterval: 30_000 },
  )

  // Domain orders (loaded for ALL + DOMAIN tabs).
  const domainKey =
    category === "SHOP" || category === "AUCTION"
      ? null
      : `/api/v1/admin/orders/domains?scope=${scope}` + (q ? `&q=${encodeURIComponent(q)}` : "")
  const { data: domainData, isLoading: domainLoading } = useSWR<{ data: { orders: AdminDomainOrderListItem[] } }>(
    domainKey,
    fetcher,
    { refreshInterval: 30_000 },
  )

  const shopOrders = shopData?.data.orders ?? []
  const domainOrders = domainData?.data.orders ?? []
  const isLoading = (shopKey && shopLoading) || (domainKey && domainLoading)
  const overdueCount = shopOrders.filter((o) => o.overdue).length
  const total = shopOrders.length + domainOrders.length

  const empty = !isLoading && total === 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">مدیریت سفارش‌ها</h1>
            <p className="text-sm text-muted-foreground">
              مرکز یکپارچه سفارش‌ها: تحویل دستی، نقشه‌راه، دامنه و مزایده — همه در یک صفحه
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

      {/* Search + category filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو با کد سفارش، نام یا ایمیل کاربر، یا دامنه…"
            className="pe-9"
          />
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 text-sm">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setCategory(t.key)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                category === t.key
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

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
      ) : empty ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
          <Package className="h-8 w-8 opacity-40" />
          {q
            ? "سفارشی با این جستجو یافت نشد."
            : scope === "active"
              ? "در حال حاضر سفارشی در جریان نیست."
              : "سفارشی یافت نشد."}
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {shopOrders.map((order) => (
            <ShopRow key={order.id} order={order} />
          ))}
          {domainOrders.map((order) => (
            <DomainRow key={order.id} order={order} />
          ))}
        </ul>
      )}
    </div>
  )
}

function buyerLabel(user: { displayName: string | null; alias: string | null; email: string | null }): string {
  return user.displayName || user.alias || user.email || "کاربر"
}

function ShopRow({ order }: { order: AdminOrderListItem }) {
  return (
    <li>
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
            <FulfillmentBadge kind={order.fulfillmentKind} />
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
            {order.publicId} · {buyerLabel(order.user)}
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
  )
}

function DomainRow({ order }: { order: AdminDomainOrderListItem }) {
  return (
    <li>
      <Link
        href={`/admin/orders/manage/domains/${order.id}`}
        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
          <Globe className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="truncate" dir="ltr">
              {order.domain}
            </strong>
            <StatusChip status={order.status} />
            <FulfillmentBadge kind="DOMAIN" />
            {order.hasNameservers && (
              <span className="rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info">
                NS ثبت شد
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {order.publicId} · {buyerLabel(order.user)}
          </p>
        </div>
        <div className="hidden text-end sm:block">
          <p className="font-bold">{formatToman(String(order.amount))} تومان</p>
        </div>
        <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  )
}
