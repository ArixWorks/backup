"use client"

import useSWR from "swr"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import {
  Plus,
  Gavel,
  XCircle,
  ExternalLink,
  ImageIcon,
  AlertTriangle,
  Trash2,
  TrendingUp,
  Trophy,
  CalendarClock,
} from "lucide-react"
import { fetcher, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { formatToman, formatNumber, formatDateTime } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection"
import { SelectionCheckbox } from "@/components/admin/bulk/selection-checkbox"
import { BulkActionsBar, type BulkDeleteResult } from "@/components/admin/bulk/bulk-actions-bar"

type Product = {
  id: string
  title: string
  saleMode: "FIXED_PRICE" | "AUCTION"
  auction: {
    id: string
    status: string
    startPrice: string
    currentPrice: string | null
    quantity: number
    startTime: string
    endTime: string
    _count: { bids: number }
  } | null
}

const statusLabels: Record<string, string> = {
  SCHEDULED: "زمان‌بندی‌شده",
  ACTIVE: "فعال",
  ENDED: "پایان‌یافته",
  FINALIZED: "نهایی‌شده",
  SOLD: "فروخته‌شده",
  SETTLED: "تسویه‌شده",
  RESERVE_NOT_MET: "به حد رزرو نرسید",
  CANCELLED: "لغوشده",
}

function statusTone(s: string): string {
  switch (s) {
    case "ACTIVE":
      return "border-chart-2/40 text-chart-2"
    case "SCHEDULED":
      return "border-chart-4/40 text-chart-4"
    case "CANCELLED":
    case "RESERVE_NOT_MET":
      return "border-destructive/40 text-destructive"
    case "FINALIZED":
    case "SOLD":
    case "SETTLED":
      return "border-primary/40 text-primary"
    default:
      return "border-border text-muted-foreground"
  }
}

export default function AdminAuctionsPage() {
  const { data, isLoading, error, mutate } = useSWR<{ ok: boolean; data: Product[] }>(
    "/api/v1/admin/products",
    fetcher,
  )
  const auctions = (data?.data ?? []).filter((p) => p.saleMode === "AUCTION" && p.auction)
  const selection = useBulkSelection(auctions.map((p) => p.id))

  const [cancelTarget, setCancelTarget] = useState<Product | null>(null)
  const [busy, setBusy] = useState(false)

  async function removeOne(p: Product) {
    if (!confirm(`حذف مزایده «${p.title}»؟ این عملیات قابل بازگشت نیست.`)) return
    try {
      await apiDelete(`/api/v1/admin/products/${p.id}`)
      toast.success("مزایده حذف شد")
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

  async function confirmCancel() {
    if (!cancelTarget?.auction) return
    setBusy(true)
    try {
      await apiPost(`/api/v1/admin/auctions/${cancelTarget.auction.id}/cancel`, {})
      toast.success("مزایده لغو شد")
      setCancelTarget(null)
      mutate()
    } catch (e: any) {
      toast.error(e.message ?? "خطا در لغو مزایده")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-1/10 text-chart-1 ring-1 ring-chart-1/20">
            <Gavel className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">مدیریت مزایده‌ها</h1>
            <p className="text-sm text-muted-foreground">وضعیت، پیشنهادها و لغو مزایده‌ها</p>
          </div>
        </div>
        <Link
          href="/admin/products/new"
          className={cn(buttonVariants(), "gap-2 shadow-sm shadow-primary/20")}
        >
          <Plus className="h-4 w-4" />
          مزایده جدید
        </Link>
      </header>

      {auctions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-2 px-3 backdrop-blur-sm">
          <span className="text-xs text-muted-foreground">
            {formatNumber(auctions.length)} مزایده
          </span>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <SelectionCheckbox
              checked={selection.allSelected}
              indeterminate={selection.someSelected}
              onChange={selection.toggleAll}
              label="انتخاب همه"
              stopPropagation={false}
            />
            انتخاب همه
          </label>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
      ) : error ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {error?.status === 401 || error?.status === 403
              ? "دسترسی ادمین لازم است. لطفاً دوباره وارد شوید."
              : `خطا در بارگذاری مزایده‌ها${error?.message ? `: ${error.message}` : ""}`}
          </p>
          <Button variant="secondary" size="sm" onClick={() => mutate()}>
            تلاش مجدد
          </Button>
        </Card>
      ) : auctions.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <Gavel className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">مزایده‌ای ثبت نشده است</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {auctions.map((p) => {
            const a = p.auction!
            const canCancel = a.status === "SCHEDULED" || a.status === "ACTIVE"
            return (
              <Card
                key={p.id}
                className={cn(
                  "group relative flex flex-row flex-wrap items-center gap-4 overflow-hidden p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:shadow-primary/5",
                  selection.isSelected(p.id) && "border-primary/60 bg-primary/5",
                )}
              >
                <span className="absolute inset-y-0 start-0 w-1 bg-chart-1/70" aria-hidden />

                <SelectionCheckbox
                  checked={selection.isSelected(p.id)}
                  onChange={() => selection.toggle(p.id)}
                  label={`انتخاب ${p.title}`}
                />

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold leading-6">{p.title}</span>
                    <Badge variant="outline" className={cn("gap-1", statusTone(a.status))}>
                      {statusLabels[a.status] ?? a.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5">
                      <TrendingUp className="h-3 w-3 text-chart-2" />
                      {a.currentPrice ? "فعلی" : "پایه"}{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatToman(a.currentPrice ?? a.startPrice)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5">
                      <Gavel className="h-3 w-3" />
                      {formatNumber(a._count.bids)} پیشنهاد
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5">
                      <Trophy className="h-3 w-3 text-chart-4" />
                      {formatNumber(a.quantity)} برنده
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5">
                      <CalendarClock className="h-3 w-3" />
                      {formatDateTime(a.endTime)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Link
                    href={`/admin/products/${p.id}`}
                    aria-label={`تصاویر ${p.title}`}
                    title="تصاویر"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/auctions/${a.id}`}
                    aria-label={`نمایش ${p.title}`}
                    title="نمایش عمومی"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(p)}
                      aria-label={`لغو ${p.title}`}
                      title="لغو مزایده"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
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

      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>لغو مزایده</DialogTitle>
            <DialogDescription>
              با لغو «{cancelTarget?.title}» مبالغ مسدودشده شرکت‌کنندگان آزاد می‌شود. این عمل
              قابل بازگشت نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              انصراف
            </Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={busy}>
              {busy ? "در حال لغو…" : "لغو مزایده"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkActionsBar
        count={selection.count}
        itemNoun="مزایده"
        onDelete={removeSelected}
        onClear={selection.clear}
        onDone={mutate}
      />
    </div>
  )
}
