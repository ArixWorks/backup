"use client"

import useSWR from "swr"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { Plus, Gavel, XCircle, ExternalLink, ImageIcon } from "lucide-react"
import { fetcher, apiPost } from "@/lib/api-client"
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
  CANCELLED: "لغوشده",
}

function statusTone(s: string): string {
  switch (s) {
    case "ACTIVE":
      return "border-chart-2/40 text-chart-2"
    case "SCHEDULED":
      return "border-chart-4/40 text-chart-4"
    case "CANCELLED":
      return "border-destructive/40 text-destructive"
    case "FINALIZED":
      return "border-primary/40 text-primary"
    default:
      return "border-border text-muted-foreground"
  }
}

export default function AdminAuctionsPage() {
  const { data, isLoading, mutate } = useSWR<{ ok: boolean; data: Product[] }>(
    "/api/v1/admin/products",
    fetcher,
  )
  const auctions = (data?.data ?? []).filter((p) => p.saleMode === "AUCTION" && p.auction)

  const [cancelTarget, setCancelTarget] = useState<Product | null>(null)
  const [busy, setBusy] = useState(false)

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
        <div>
          <h1 className="text-2xl font-bold">مدیریت مزایده‌ها</h1>
          <p className="text-sm text-muted-foreground">وضعیت، پیشنهادها و لغو مزایده‌ها</p>
        </div>
        <Link href="/admin/products/new" className={cn(buttonVariants(), "gap-2")}>
          <Plus className="h-4 w-4" />
          مزایده جدید
        </Link>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
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
              <Card key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.title}</span>
                    <Badge variant="outline" className={statusTone(a.status)}>
                      {statusLabels[a.status] ?? a.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>پایه: {formatToman(a.startPrice)} ت</span>
                    {a.currentPrice && <span>فعلی: {formatToman(a.currentPrice)} ت</span>}
                    <span>{formatNumber(a._count.bids)} پیشنهاد</span>
                    <span>{formatNumber(a.quantity)} برنده</span>
                    <span>پایان: {formatDateTime(a.endTime)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    تصاویر
                  </Link>
                  <Link
                    href={`/auctions/${a.id}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    نمایش
                  </Link>
                  {canCancel && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive"
                      onClick={() => setCancelTarget(p)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      لغو
                    </Button>
                  )}
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
    </div>
  )
}
