"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { AlertTriangle, ChevronLeft, ChevronRight, Search, ShoppingBag, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { apiDelete, ApiError, fetcher } from "@/lib/api-client"
import { formatNumber, formatToman } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SelectionCheckbox } from "@/components/admin/bulk/selection-checkbox"

type Order = {
  id: string
  publicId: string
  type: "FIXED_PURCHASE" | "BUY_NOW" | "AUCTION_WIN"
  status: string
  amount: string
  quantity: number
  createdAt: string
  product: { title: string }
  user: { displayName: string; alias: string | null }
}
type Response = { data: { orders: Order[]; total: number; refundTotal: string; page: number; pageSize: number } }

const typeLabels = { FIXED_PURCHASE: "خرید مستقیم", BUY_NOW: "خرید فوری", AUCTION_WIN: "برنده مزایده" }

export default function AdminOrdersCleanupPage() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [type, setType] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const query = useMemo(() => new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(type && { type }), page: String(page) }).toString(), [q, status, type, page])
  const { data, error, isLoading, mutate } = useSWR<Response>(`/api/v1/admin/orders/cleanup?${query}`, fetcher)
  const result = data?.data
  const orders = result?.orders ?? []
  const allPage = orders.length > 0 && orders.every((order) => selected.has(order.id))

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function removeIds(ids: string[]) {
    if (!confirm(`${formatNumber(ids.length)} خرید آزمایشی بازپرداخت و برای همیشه حذف شود؟`)) return
    setBusy(true)
    try {
      const response = await apiDelete<{ data: { deleted: string[]; skipped: unknown[] } }>("/api/v1/admin/orders/cleanup", { scope: "ids", ids })
      toast.success(`${formatNumber(response.data.deleted.length)} خرید پاک‌سازی شد`)
      setSelected(new Set())
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "پاک‌سازی ناموفق بود")
    } finally { setBusy(false) }
  }

  async function removeFiltered() {
    const typed = prompt(`برای بازپرداخت و حذف ${formatNumber(result?.total ?? 0)} خرید فیلترشده عبارت DELETE-TEST-PURCHASES را وارد کنید.`)
    if (typed !== "DELETE-TEST-PURCHASES") return
    setBusy(true)
    try {
      const response = await apiDelete<{ data: { deleted: string[] } }>("/api/v1/admin/orders/cleanup", {
        scope: "filtered",
        confirm: typed,
        filters: { query: q || undefined, status: status || undefined, type: type || undefined },
      })
      toast.success(`${formatNumber(response.data.deleted.length)} خرید پاک‌سازی شد`)
      setSelected(new Set())
      setPage(1)
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "پاک‌سازی ناموفق بود")
    } finally { setBusy(false) }
  }

  return <div className="flex flex-col gap-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20"><ShoppingBag className="h-5 w-5" /></span>
        <div><h1 className="text-2xl font-bold tracking-tight">پاک‌سازی خریدهای آزمایشی</h1><p className="text-sm text-muted-foreground">فقط مالک؛ بازپرداخت کامل، بازگردانی موجودی و حذف سابقه تست</p></div>
      </div>
      {!!result?.total && <Button variant="destructive" disabled={busy} onClick={removeFiltered}><Trash2 className="h-4 w-4" />حذف همه فیلترشده</Button>}
    </header>

    <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>این ابزار فقط برای داده‌های تست است. مبلغ خرید و پاداش مرتبط برگشت می‌خورد و عملیات قابل بازگشت نیست.</p></div></Card>

    <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-card p-3">
      <div className="relative min-w-56 flex-1"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="شناسه، محصول یا خریدار" className="pr-9" /></div>
      <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">همه وضعیت‌ها</option><option value="PAID">پرداخت‌شده</option><option value="DELIVERED">تحویل‌شده</option><option value="PENDING">در انتظار</option></select>
      <select value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">همه انواع</option><option value="FIXED_PURCHASE">خرید مستقیم</option><option value="BUY_NOW">خرید فوری</option><option value="AUCTION_WIN">مزایده</option></select>
    </div>

    {error ? <Card className="p-10 text-center text-sm text-destructive">{error.status === 403 ? "این ابزار غیرفعال است یا فقط برای مالک اصلی مجاز است." : "خطا در بارگذاری خریدها"}</Card> : isLoading ? <p className="text-sm text-muted-foreground">در حال بارگذاری…</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{formatNumber(result?.total ?? 0)} خرید · بازپرداخت کل {formatToman(result?.refundTotal ?? "0")} تومان</span>{selected.size > 0 && <Button variant="destructive" size="sm" disabled={busy} onClick={() => removeIds([...selected])}>حذف {formatNumber(selected.size)} مورد انتخابی</Button>}</div>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 p-3 text-sm"><SelectionCheckbox checked={allPage} onChange={() => setSelected(allPage ? new Set() : new Set(orders.map((order) => order.id)))} label="انتخاب صفحه" stopPropagation={false} /><span>انتخاب صفحه</span></div>
        <div className="divide-y divide-border">{orders.map((order) => <article key={order.id} className="flex flex-wrap items-center gap-4 p-4">
          <SelectionCheckbox checked={selected.has(order.id)} onChange={() => toggle(order.id)} label={`انتخاب ${order.publicId}`} />
          <div className="min-w-48 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{order.product.title}</strong><Badge variant="secondary">{typeLabels[order.type]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{order.publicId} · {order.user.displayName || order.user.alias || "کاربر"} · {new Date(order.createdAt).toLocaleDateString("fa-IR")}</p></div>
          <div className="text-end"><p className="font-bold">{formatToman(order.amount)} تومان</p><p className="text-xs text-muted-foreground">تعداد {formatNumber(order.quantity)}</p></div>
          <Button variant="ghost" size="icon" disabled={busy} onClick={() => removeIds([order.id])} aria-label={`حذف ${order.publicId}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </article>)}</div>
        {orders.length === 0 && <p className="p-12 text-center text-sm text-muted-foreground">خریدی یافت نشد</p>}
      </Card>
      <div className="flex items-center justify-center gap-3"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronRight className="h-4 w-4" /></Button><span className="text-sm">صفحه {formatNumber(page)}</span><Button variant="outline" size="icon" disabled={!result || page * result.pageSize >= result.total} onClick={() => setPage((value) => value + 1)}><ChevronLeft className="h-4 w-4" /></Button></div>
    </>}
  </div>
}
