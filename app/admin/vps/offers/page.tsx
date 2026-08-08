"use client"

import useSWR from "swr"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Plus, Search, Server, AlertTriangle, Trash2, Eye, EyeOff, Pencil, MapPin, Cpu } from "lucide-react"
import { fetcher, apiDelete, apiPatch, ApiError } from "@/lib/api-client"
import { formatToman, formatNumber } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AdminOffer = {
  id: string
  name: string
  slug: string
  location: string
  cpu: string
  ram: string
  storage: string
  priceIrt: string
  stockStatus: string
  active: boolean
  sortOrder: number
  _count?: { orders: number; instances: number }
}

const STOCK_LABEL: Record<string, string> = {
  AVAILABLE: "موجود",
  LIMITED: "محدود",
  ON_REQUEST: "بنا به درخواست",
  TEMPORARILY_UNAVAILABLE: "موقتاً ناموجود",
  DISABLED: "غیرفعال",
}

export default function AdminVpsOffersPage() {
  const { data, isLoading, error, mutate } = useSWR<{ ok: boolean; data: AdminOffer[] }>(
    "/api/v1/admin/vps/offers",
    fetcher,
  )
  const [q, setQ] = useState("")
  const offers = (data?.data ?? []).filter((o) => o.name.toLowerCase().includes(q.toLowerCase()))

  async function removeOne(o: AdminOffer) {
    if (!confirm(`حذف پلن «${o.name}»؟ این عملیات قابل بازگشت نیست.`)) return
    try {
      await apiDelete(`/api/v1/admin/vps/offers/${o.id}`)
      toast.success("پلن حذف شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف")
    }
  }

  async function toggleActive(o: AdminOffer) {
    try {
      await apiPatch(`/api/v1/admin/vps/offers/${o.id}`, { active: !o.active })
      toast.success(!o.active ? "پلن فعال شد" : "پلن غیرفعال شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در تغییر وضعیت")
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Server className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">پلن‌های VPS</h1>
            <p className="text-sm text-muted-foreground">ساخت و مدیریت پلن‌های سرور مجازی</p>
          </div>
        </div>
        <Link href="/admin/vps/offers/new" className={cn(buttonVariants(), "gap-2 shadow-sm shadow-primary/20")}>
          <Plus className="h-4 w-4" />
          پلن جدید
        </Link>
      </header>

      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-2 backdrop-blur-sm">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="جستجوی پلن…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border-0 bg-secondary/60 pr-9 focus-visible:ring-1"
          />
        </div>
        {!isLoading && !error && (
          <span className="hidden px-1 text-xs text-muted-foreground sm:inline">
            {formatNumber(offers.length)} پلن
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
      ) : error ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {error?.status === 401 || error?.status === 403
              ? "دسترسی ادمین لازم است."
              : "خطا در بارگذاری پلن‌ها"}
          </p>
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            تلاش مجدد
          </Button>
        </Card>
      ) : offers.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <Server className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">هنوز پلنی ساخته نشده است</p>
          <Link href="/admin/vps/offers/new" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-2 gap-2")}>
            <Plus className="h-4 w-4" />
            ساخت اولین پلن
          </Link>
        </Card>
      ) : (
        <div className="grid gap-3">
          {offers.map((o) => (
            <Card
              key={o.id}
              className="group relative flex flex-row flex-nowrap items-center gap-4 overflow-hidden p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:shadow-primary/5"
            >
              <span className="absolute inset-y-0 start-0 w-1 bg-chart-2/70" aria-hidden />
              <Link href={`/admin/vps/offers/${o.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground ring-1 ring-border/60">
                  <Server className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold leading-6">{o.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{STOCK_LABEL[o.stockStatus] ?? o.stockStatus}</Badge>
                    {!o.active && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">غیرفعال</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5">
                      <MapPin className="h-3 w-3" />
                      {o.location}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5">
                      <Cpu className="h-3 w-3" />
                      {o.cpu} / {o.ram} / {o.storage}
                    </span>
                  </div>
                </div>
                <div className="ms-auto flex flex-col items-end justify-center gap-0.5 border-e border-border/60 pe-4 text-end">
                  <p className="text-base font-bold tabular-nums text-foreground">
                    {formatToman(o.priceIrt)}
                    <span className="ms-1 text-[11px] font-normal text-muted-foreground">تومان</span>
                  </p>
                  {o._count && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatNumber(o._count.instances)} سرور فعال
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  href={`/admin/vps/offers/${o.id}`}
                  aria-label={`ویرایش ${o.name}`}
                  title="ویرایش"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => toggleActive(o)}
                  aria-label={o.active ? `غیرفعال‌کردن ${o.name}` : `فعال‌کردن ${o.name}`}
                  title={o.active ? "غیرفعال‌کردن" : "فعال‌کردن"}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {o.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => removeOne(o)}
                  aria-label={`حذف ${o.name}`}
                  title="حذف"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
