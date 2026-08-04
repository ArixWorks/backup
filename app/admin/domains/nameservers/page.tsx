"use client"

import { useState } from "react"
import useSWR from "swr"
import { CheckCircle2, Clock, Globe2, Loader2, RefreshCw, Search, Server, XCircle } from "lucide-react"
import { toast } from "sonner"
import { apiPost, fetcher } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AdminNsRequestListItem } from "@/lib/orders/shared"

type Scope = "pending" | "completed" | "rejected" | "all"

const SCOPES: { value: Scope; label: string }[] = [
  { value: "pending", label: "تکمیل‌نشده" },
  { value: "completed", label: "تکمیل‌شده" },
  { value: "rejected", label: "ردشده / جایگزین" },
  { value: "all", label: "همه" },
]

const STATUS_META: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  PENDING: { label: "در انتظار", icon: Clock, className: "text-warning" },
  COMPLETED: { label: "ثبت شد", icon: CheckCircle2, className: "text-primary" },
  REJECTED: { label: "رد شد", icon: XCircle, className: "text-destructive" },
  CANCELLED: { label: "جایگزین شد", icon: XCircle, className: "text-muted-foreground" },
}

const date = (value: string) => new Date(value).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" })

export default function AdminNameserversPage() {
  const [scope, setScope] = useState<Scope>("pending")
  const [query, setQuery] = useState("")
  const endpoint = `/api/v1/admin/domains/nameservers?scope=${scope}&q=${encodeURIComponent(query)}`
  const { data, isLoading, mutate } = useSWR<{ data: { items: AdminNsRequestListItem[] } }>(endpoint, fetcher, {
    refreshInterval: 15_000,
  })
  const items = data?.data.items ?? []

  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<AdminNsRequestListItem | null>(null)
  const [rejectNote, setRejectNote] = useState("")

  async function complete(item: AdminNsRequestListItem) {
    if (!window.confirm(`نیم‌سرورهای ${item.domain} در رجیسترار ثبت شده‌اند و این درخواست تکمیل شود؟`)) return
    setBusy(item.id)
    try {
      await apiPost(`/api/v1/admin/domains/nameservers/${item.id}/action`, { action: "complete" })
      toast.success("درخواست تکمیل شد و به کاربر اطلاع داده شد.")
      await mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "عملیات انجام نشد.")
    } finally {
      setBusy(null)
    }
  }

  async function reject() {
    if (!rejecting) return
    setBusy(rejecting.id)
    try {
      await apiPost(`/api/v1/admin/domains/nameservers/${rejecting.id}/action`, { action: "reject", note: rejectNote.trim() || undefined })
      toast.success("درخواست رد شد و به کاربر اطلاع داده شد.")
      setRejecting(null)
      setRejectNote("")
      await mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "عملیات انجام نشد.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-2.5">
            <Server className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-balance">درخواست‌های تغییر نیم‌سرور</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              درخواست‌های ثبت و تغییر NS کاربران را بررسی، در رجیسترار اعمال و تایید کنید.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void mutate()}>
          <RefreshCw data-icon="inline-start" />
          تازه‌سازی
        </Button>
      </header>

      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle>صف درخواست‌ها</CardTitle>
            <CardDescription>هر ثبت یا تغییر NS توسط کاربر یک درخواست مجزا می‌سازد که باید تایید یا رد شود.</CardDescription>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="فیلتر وضعیت">
              {SCOPES.map((s) => (
                <Button
                  key={s.value}
                  size="sm"
                  role="tab"
                  aria-selected={scope === s.value}
                  variant={scope === s.value ? "default" : "outline"}
                  onClick={() => setScope(s.value)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="relative md:w-72">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pr-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جست‌وجوی دامنه، کاربر یا شناسه..."
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>دامنه</TableHead>
                <TableHead>کاربر</TableHead>
                <TableHead>نیم‌سرورهای درخواستی</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>زمان درخواست</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center text-muted-foreground">
                    درخواستی با این فیلتر وجود ندارد.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const meta = STATUS_META[item.status] ?? STATUS_META.PENDING
                  const Icon = meta.icon
                  return (
                    <TableRow key={item.id}>
                      <TableCell dir="ltr" className="text-left font-medium">
                        <div className="flex items-center gap-2">
                          <Globe2 className="size-4 shrink-0 text-muted-foreground" />
                          {item.domain}
                        </div>
                        <span className="block font-mono text-[11px] text-muted-foreground">{item.orderPublicId}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="block font-medium">{item.user.displayName || item.user.alias || "—"}</span>
                        <span dir="ltr" className="block text-left text-xs text-muted-foreground">
                          {item.user.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div dir="ltr" className="flex min-w-44 flex-col gap-1 text-left font-mono text-xs">
                          {item.nameservers.map((ns) => (
                            <span key={ns}>{ns}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Icon className={`size-3.5 ${meta.className}`} />
                          {meta.label}
                        </Badge>
                        {item.status === "REJECTED" && item.note && (
                          <p className="mt-1 max-w-40 text-xs text-destructive text-pretty">{item.note}</p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{date(item.requestedAt)}</TableCell>
                      <TableCell>
                        {item.status === "PENDING" ? (
                          <div className="flex min-w-max gap-2">
                            <Button size="sm" onClick={() => void complete(item)} disabled={busy !== null}>
                              {busy === item.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                              تایید و ثبت شد
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/50 text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setRejecting(item)
                                setRejectNote("")
                              }}
                              disabled={busy !== null}
                            >
                              رد
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{item.resolvedAt ? date(item.resolvedAt) : "—"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رد درخواست تغییر NS</DialogTitle>
            <DialogDescription>
              دلیل رد برای کاربر ارسال می‌شود. کاربر می‌تواند دوباره درخواست جدیدی ثبت کند.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <label className="flex flex-col gap-2 text-sm font-medium">
              دلیل رد (اختیاری)
              <Textarea
                dir="auto"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="مثلاً: نیم‌سرورهای واردشده معتبر نیستند."
              />
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              انصراف
            </Button>
            <Button variant="destructive" onClick={() => void reject()} disabled={busy !== null}>
              {busy === rejecting?.id && <Loader2 className="animate-spin" />}
              رد درخواست
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
