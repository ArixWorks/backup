"use client"

import useSWR from "swr"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"
import { Plus, Search, Package, AlertTriangle, Trash2 } from "lucide-react"
import { fetcher, apiDelete, ApiError } from "@/lib/api-client"
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

  async function removeSelected(): Promise<BulkDeleteResult> {
    const res = await apiDelete<{ data: BulkDeleteResult }>("/api/v1/admin/products", {
      ids: selection.selectedIds,
    })
    return res.data
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مدیریت محصولات</h1>
          <p className="text-sm text-muted-foreground">
            ساخت و ویرایش محصولات فروشگاه و مزایده
          </p>
        </div>
        <Link href="/admin/products/new" className={cn(buttonVariants(), "gap-2")}>
          <Plus className="h-4 w-4" />
          محصول جدید
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="جستجوی محصول…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pr-9"
          />
        </div>
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
          {products.map((p) => (
            <Card
              key={p.id}
              className={cn(
                "flex items-center gap-3 p-4 transition-colors hover:border-primary/50",
                selection.isSelected(p.id) && "border-primary/60 bg-primary/5",
              )}
            >
              <SelectionCheckbox
                checked={selection.isSelected(p.id)}
                onChange={() => selection.toggle(p.id)}
                label={`انتخاب ${p.title}`}
              />
              <Link href={`/admin/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  {p.coverImage && (
                    <Image
                      src={p.coverImage || "/placeholder.svg"}
                      alt={p.title}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.title}</span>
                    {p.hidden && (
                      <Badge variant="secondary" className="text-[10px]">
                        مخفی
                      </Badge>
                    )}
                    {!p.active && (
                      <Badge variant="outline" className="text-[10px]">
                        غیرفعال
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        p.saleMode === "AUCTION"
                          ? "border-chart-1/40 text-chart-1"
                          : "border-chart-2/40 text-chart-2",
                      )}
                    >
                      {p.saleMode === "AUCTION" ? "مزایده" : "فروشگاه"}
                    </Badge>
                    <span>
                      {p.deliveryType === "AUTOMATIC" ? "تحویل خودکار" : "تحویل دستی"}
                    </span>
                    {p.deliveryType === "AUTOMATIC" && (
                      <span>موجودی: {formatNumber(p._count.inventoryItems)}</span>
                    )}
                    <span>سفارش‌ها: {formatNumber(p._count.orders)}</span>
                  </div>
                </div>
                <div className="text-left">
                  {p.saleMode === "FIXED_PRICE" && p.fixedSale ? (
                    <>
                      <p className="font-mono text-sm font-semibold" dir="ltr">
                        {formatToman(p.fixedSale.price)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        انبار: {formatNumber(p.fixedSale.stock)}
                      </p>
                    </>
                  ) : p.auction ? (
                    <>
                      <p className="font-mono text-sm font-semibold" dir="ltr">
                        {formatToman(p.auction.startPrice)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(p.auction._count.bids)} پیشنهاد
                      </p>
                    </>
                  ) : null}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => removeOne(p)}
                aria-label={`حذف ${p.title}`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Card>
          ))}
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
