"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { ShieldCheck, Loader2, Check, X, Clock } from "lucide-react"
import { fetcher, apiPatch, ApiError } from "@/lib/api-client"
import { formatRelative } from "@/lib/format"
import { StatusPill } from "@/components/admin/status-pill"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type ReRequest = {
  id: string
  reason: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  adminMessage: string | null
  grantedUses: number
  createdAt: string
  resolvedAt: string | null
  user: { id: string; displayName: string | null; alias: string }
  totpUsage: {
    usedCount: number
    bonusUses: number
    deliveryId: string | null
    winnerId: string | null
    totpSecret: {
      maxUses: number | null
      inventoryItem: { product: { title: string } } | null
    } | null
  } | null
}

type Filter = "PENDING" | "APPROVED" | "REJECTED"

export default function TwoFactorRequestsPage() {
  const [filter, setFilter] = useState<Filter>("PENDING")
  const { data, isLoading, mutate } = useSWR<ReRequest[]>(
    `/api/v1/admin/2fa-requests?status=${filter}`,
    fetcher,
    { refreshInterval: 15000 },
  )
  const rows = data ?? []

  const [active, setActive] = useState<ReRequest | null>(null)
  const [mode, setMode] = useState<"approve" | "reject">("approve")
  const [grant, setGrant] = useState("3")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  function open(req: ReRequest, m: "approve" | "reject") {
    setMode(m)
    setGrant("3")
    setMessage("")
    setActive(req)
  }

  async function submit() {
    if (!active) return
    setSaving(true)
    try {
      const body =
        mode === "approve"
          ? { action: "approve", grantedUses: Math.max(1, Number(grant) || 1), message: message.trim() || undefined }
          : { action: "reject", message: message.trim() || undefined }
      await apiPatch(`/api/v1/admin/2fa-requests/${active.id}`, body)
      toast.success(mode === "approve" ? "درخواست تأیید شد" : "درخواست رد شد")
      setActive(null)
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ثبت")
    } finally {
      setSaving(false)
    }
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "PENDING", label: "در انتظار" },
    { key: "APPROVED", label: "تأییدشده" },
    { key: "REJECTED", label: "ردشده" },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">درخواست‌های دریافت مجدد ۲FA</h1>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        کاربرانی که سقف دریافت کد دومرحله‌ای‌شان تمام شده و درخواست دریافت مجدد داده‌اند.
      </p>

      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            درخواستی در این وضعیت نیست.
          </div>
        ) : (
          rows.map((r) => {
            const limit = r.totpUsage?.totpSecret?.maxUses
            const bonus = r.totpUsage?.bonusUses ?? 0
            return (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">
                      {r.totpUsage?.totpSecret?.inventoryItem?.product.title ?? "اکانت"}
                    </span>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.user.displayName || r.user.alias} ({r.user.alias}) ·{" "}
                    <Clock className="inline h-3 w-3" /> {formatRelative(r.createdAt)}
                    {limit != null && (
                      <>
                        {" "}· مصرف {r.totpUsage?.usedCount ?? 0} از {limit + bonus}
                      </>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words rounded-lg bg-secondary/60 p-2 text-sm" dir="auto">
                    {r.reason}
                  </p>
                  {r.status !== "PENDING" && r.adminMessage && (
                    <p className="text-xs text-muted-foreground">پاسخ ادمین: {r.adminMessage}</p>
                  )}
                  {r.status === "APPROVED" && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {r.grantedUses} دریافت اضافه اعطا شد.
                    </p>
                  )}
                </div>
                {r.status === "PENDING" && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => open(r, "approve")} className="gap-1.5">
                      <Check className="h-4 w-4" />
                      تأیید
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => open(r, "reject")} className="gap-1.5">
                      <X className="h-4 w-4" />
                      رد
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? "تأیید درخواست" : "رد درخواست"}</DialogTitle>
            <DialogDescription>
              {mode === "approve"
                ? "تعداد دریافت‌های اضافه‌ای که به کاربر اعطا می‌شود را مشخص کنید."
                : "در صورت تمایل، دلیل رد را برای کاربر بنویسید."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {mode === "approve" && (
              <div className="space-y-1.5">
                <Label htmlFor="grant">تعداد دریافت اضافه</Label>
                <Input
                  id="grant"
                  dir="ltr"
                  inputMode="numeric"
                  className="tabular-nums"
                  value={grant}
                  onChange={(e) => setGrant(e.target.value.replace(/[^0-9]/g, ""))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="msg">پیام برای کاربر (اختیاری)</Label>
              <Input id="msg" value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)} disabled={saving}>
              انصراف
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "approve" ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
              {mode === "approve" ? "تأیید و اعطا" : "رد درخواست"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
