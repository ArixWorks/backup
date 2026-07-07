"use client"

import useSWR from "swr"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Trash2,
  Eye,
  EyeOff,
  Store,
  Gavel,
  Boxes,
  ShoppingCart,
  Zap,
  Hand,
  Pencil,
  ImageOff,
} from "lucide-react"
import { fetcher, apiDelete, apiPatch, ApiError } from "@/lib/api-client"
import { formatToman, formatNumber } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection"
import { SelectionCheckbox } from "@/components/admin/bulk/selection-checkbox"
import { BulkActionsBar, type BulkDeleteResult } from "@/components/admin/bulk/bulk-actions-bar"

type Product = {
  id: string
  title: string
  coverImage: string | null
  category: string | null
  saleMode: "FIXED_PRICE" | "AUCTION"
  deliveryType: "MANUAL" | "AUTOMATIC"
  active: boolean
  hidden: boolean
  fixedSale: { price: string; stock: number; reservedStock: number } | null
  auction: { status: string; startPrice: string; _count: { bids: number } } | null
  _count: { inventoryItems: number; orders: number }
}

export default function AdminProductsPage() {
  const { data, isLoading, error, mutate } = useSWR<{ ok: boolean; data: Product[] }>(
    "/api/v1/admin/products",
    fetcher,
  )
  const [q, setQ] = useState("")
  const products = (data?.data ?? []).filter((p) =>
    p.title.toLowerCase().includes(q.toLowerCase()),
  )
  const selection = useBulkSelection(products.map((p) => p.id))

  async function removeOne(p: Product) {
    if (!confirm(`حذف «${p.title}»؟ این عملیات قابل بازگشت نیست.`)) return
    try {
      await apiDelete(`/api/v1/admin/products/${p.id}`)
      toast.success("محصول حذف شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف")
    }
  }

  async function toggleHidden(p: Product) {
    const next = !p.hidden
    try {
      await apiPatch(`/api/v1/admin/products/${p.id}`, { hidden: next })
      toast.success(next ? "محصول از نمایش کاربران مخفی شد" : "محصول برای کاربران نمایش داده شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در تغییر وضعیت نمایش")
    }
  }

  async function removeSelected(): Promise<BulkDeleteResult> {
    const res = await apiDelete<{ data: BulkDeleteResult }>("/api/v1/admin/products", {
      ids: selection.selectedIds,
    })
    return res.data
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Package className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">مدیریت محصولات</h1>
            <p className="text-sm text-muted-foreground">
              ساخت و ویرایش محصولات فروشگاه و مزایده
            </p>
          </div>
        </div>
        <Link
          href="/admin/products/new"
          className={cn(buttonVariants(), "gap-2 shadow-sm shadow-primary/20")}
        >
          <Plus className="h-4 w-4" />
          محصول جدید
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-2 backdrop-blur-sm">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="جستجوی محصول…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border-0 bg-secondary/60 pr-9 focus-visible:ring-1"
          />
        </div>
        <div className="flex items-center gap-3 px-1">
          {!isLoading && !error && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {formatNumber(products.length)} محصول
            </span>
          )}
          {products.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <SelectionCheckbox
                checked={selection.allSelected}
                indeterminate={selection.someSelected}
                onChange={selection.toggleAll}
                label="انتخاب همه"
                stopPropagation={false}
              />
              انتخاب همه
            </label>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
      ) : error ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {error?.status === 401 || error?.status === 403
              ? "دسترسی ادمین لازم است. لطفاً دوباره وارد شوید."
              : `خطا در بارگذاری محصولات${error?.message ? `: ${error.message}` : ""}`}
          </p>
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            تلاش مجدد
          </Button>
        </Card>
      ) : products.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <Package className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">محصولی یافت نشد</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {products.map((p) => {
            const isAuction = p.saleMode === "AUCTION"
            const isAuto = p.deliveryType === "AUTOMATIC"
            const price =
              p.saleMode === "FIXED_PRICE" && p.fixedSale
                ? p.fixedSale.price
                : p.auction
                  ? p.auction.startPrice
                  : null
            return (
              <Card
                key={p.id}
                className={cn(
                  "group relative flex flex-row flex-nowrap items-center gap-4 overflow-hidden p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:shadow-primary/5",
                  selection.isSelected(p.id) && "border-primary/60 bg-primary/5",
                )}
              >
                {/* colored accent strip on the inline-start edge */}
                <span
                  className={cn(
                    "absolute inset-y-0 start-0 w-1",
                    isAuction ? "bg-chart-1/70" : "bg-chart-2/70",
                  )}
                  aria-hidden
                />

                <SelectionCheckbox
                  checked={selection.isSelected(p.id)}
                  onChange={() => selection.toggle(p.id)}
                  label={`انتخاب ${p.title}`}
                />

                <Link
                  href={`/admin/products/${p.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-border/60 transition-transform duration-200 group-hover:scale-[1.03]">
                    {p.coverImage ? (
                      <Image
                        src={p.coverImage || "/placeholder.svg"}
                        alt={p.title}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                        <ImageOff className="h-5 w-5" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold leading-6">{p.title}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          isAuction
                            ? "bg-chart-1/10 text-chart-1"
                            : "bg-chart-2/10 text-chart-2",
                        )}
                      >
                        {isAuction ? (
                          <Gavel className="h-3 w-3" />
                        ) : (
                          <Store className="h-3 w-3" />
                        )}
                        {isAuction ? "مزایده" : "فروشگاه"}
                      </span>
                      {p.hidden && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <EyeOff className="h-3 w-3" />
                          مخفی
                        </Badge>
                      )}
                      {!p.active && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          غیرفعال
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5">
                        {isAuto ? (
                          <Zap className="h-3 w-3 text-chart-4" />
                        ) : (
                          <Hand className="h-3 w-3" />
                        )}
                        {isAuto ? "تحویل خودکار" : "تحویل دستی"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5">
                        <ShoppingCart className="h-3 w-3" />
                        {formatNumber(p._count.orders)} سفارش
                      </span>
                      {isAuto && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5">
                          <Boxes className="h-3 w-3" />
                          موجودی {formatNumber(p._count.inventoryItems)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ms-auto flex flex-col items-end justify-center gap-0.5 border-e border-border/60 pe-4 text-end">
                    {price ? (
                      <>
                        <p className="text-base font-bold tabular-nums text-foreground">
                          {formatToman(price)}
                          <span className="ms-1 text-[11px] font-normal text-muted-foreground">
                            تومان
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.saleMode === "FIXED_PRICE" && p.fixedSale
                            ? `انبار ${formatNumber(p.fixedSale.stock)}`
                            : p.auction
                              ? `${formatNumber(p.auction._count.bids)} پیشنهاد`
                              : ""}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </Link>

                <div className="flex items-center gap-1">
                  <Link
                    href={`/admin/products/${p.id}`}
                    aria-label={`ویرایش ${p.title}`}
                    title="ویرایش"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleHidden(p)}
                    aria-label={
                      p.hidden ? `نمایش ${p.title} به کاربران` : `مخفی‌کردن ${p.title} از کاربران`
                    }
                    title={p.hidden ? "نمایش به کاربران" : "مخفی‌کردن از کاربران"}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {p.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOne(p)}
                    aria-label={`حذف ${p.title}`}
                    title="حذف"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <BulkActionsBar
        count={selection.count}
        itemNoun="محصول"
        onDelete={removeSelected}
        onClear={selection.clear}
        onDone={mutate}
      />
    </div>
  )
}
