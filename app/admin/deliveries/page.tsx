"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Package, Send, Loader2, AlertTriangle } from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { formatToman, formatRelative } from "@/lib/format"
import { StatusPill } from "@/components/admin/status-pill"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Delivery = {
  id: string
  status: string
  error: string | null
  createdAt: string
  order: {
    publicId: string
    amount: number
    quantity: number
    user: { displayName: string; alias: string }
    product: { title: string }
  }
}

export default function DeliveriesPage() {
  const { data, isLoading, mutate } = useSWR<{ data: Delivery[] }>(
    "/api/v1/admin/deliveries",
    fetcher,
    { refreshInterval: 10000 },
  )
  const rows = data?.data ?? []

  const [active, setActive] = useState<Delivery | null>(null)
  const [form, setForm] = useState({ username: "", password: "", licenseKey: "", note: "" })
  const [saving, setSaving] = useState(false)

  function openDialog(d: Delivery) {
    setForm({ username: "", password: "", licenseKey: "", note: "" })
    setActive(d)
  }

  async function submit() {
    if (!active) return
    if (!form.username && !form.password && !form.licenseKey && !form.note) {
      return toast.error("حداقل یک فیلد تحویل را پر کنید")
    }
    setSaving(true)
    try {
      await apiPost(`/api/v1/admin/deliveries/${active.id}/complete`, form)
      toast.success("سفارش با موفقیت تحویل شد")
      setActive(null)
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ثبت تحویل")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Package className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">تحویل دستی سفارش‌ها</h1>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        سفارش‌های پرداخت‌شده‌ای که منتظر ارسال اطلاعات (اکانت/لایسنس) به کاربر هستند.
      </p>

      <div className="space-y-3">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            سفارشی در انتظار تحویل نیست.
          </div>
        ) : (
          rows.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{d.order.product.title}</span>
                  <StatusPill status={d.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {d.order.user.displayName} ({d.order.user.alias}) · سفارش {d.order.publicId} ·{" "}
                  {d.order.quantity} عدد · {formatToman(d.order.amount)} ت ·{" "}
                  {formatRelative(d.createdAt)}
                </div>
                {d.error && (
                  <div className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {d.error}
                  </div>
                )}
              </div>
              <Button onClick={() => openDialog(d)} className="gap-2 sm:w-40">
                <Send className="h-4 w-4" />
                ثبت تحویل
              </Button>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ثبت اطلاعات تحویل</DialogTitle>
            <DialogDescription>
              {active?.order.product.title} — برای {active?.order.user.displayName}. این اطلاعات به
              کاربر نمایش داده می‌شود.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="u">نام کاربری</Label>
                <Input
                  id="u"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p">رمز عبور</Label>
                <Input
                  id="p"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k">کلید لایسنس</Label>
              <Input
                id="k"
                value={form.licenseKey}
                onChange={(e) => setForm({ ...form, licenseKey: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n">یادداشت / توضیحات</Label>
              <Textarea
                id="n"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={3}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>
              انصراف
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              تحویل و تکمیل سفارش
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
