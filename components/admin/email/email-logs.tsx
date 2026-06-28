"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Loader2, RotateCw, Search } from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDateTime } from "@/lib/format"
import { STATUS_LABELS, STATUS_TONE, TEMPLATE_LABELS } from "./labels"

type Job = {
  id: string
  to: string
  subject: string
  template: string
  sender: string
  status: string
  attempts: number
  maxAttempts: number
  lastError: string | null
  providerId: string | null
  openCount: number
  clickCount: number
  queuedAt: string
  sentAt: string | null
  deliveredAt: string | null
  failedAt: string | null
}

const STATUS_OPTIONS = ["QUEUED", "PROCESSING", "SENT", "DELIVERED", "FAILED", "BOUNCED", "COMPLAINED", "CANCELED"]

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "muted"
  const cls =
    tone === "good"
      ? "border-success/40 text-success"
      : tone === "bad"
        ? "border-destructive/40 text-destructive"
        : tone === "warn"
          ? "border-warning/40 text-warning"
          : "border-border text-muted-foreground"
  return (
    <Badge variant="outline" className={cls}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

export function EmailLogs() {
  const [status, setStatus] = useState("ALL")
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const params = new URLSearchParams({ page: String(page), pageSize: "25" })
  if (status !== "ALL") params.set("status", status)
  if (search) params.set("q", search)

  const { data, isLoading, mutate } = useSWR<{ data: { total: number; items: Job[]; pageSize: number } }>(
    `/api/v1/admin/email?${params.toString()}`,
    fetcher,
    { refreshInterval: 15_000 },
  )

  const { data: detail } = useSWR<{ data: Job & { events: { id: string; type: string; occurredAt: string }[] } }>(
    selected ? `/api/v1/admin/email/${selected}` : null,
    fetcher,
  )

  const total = data?.data.total ?? 0
  const pageSize = data?.data.pageSize ?? 25
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  async function retry(id: string) {
    setRetrying(true)
    try {
      await apiPost(`/api/v1/admin/email/${id}`, { action: "retry" })
      toast.success("ایمیل دوباره در صف قرار گرفت")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در تلاش مجدد")
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setSearch(q)
          }}
        >
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی گیرنده، موضوع یا شناسه ارسال…"
            className="pr-9"
          />
        </form>
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1)
            setStatus(v ?? "ALL")
          }}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="وضعیت" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : data?.data.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">ایمیلی یافت نشد.</p>
        ) : (
          <div className="divide-y divide-border">
            {data?.data.items.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelected(job.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{job.to}</p>
                  <p className="truncate text-xs text-muted-foreground">{job.subject}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {TEMPLATE_LABELS[job.template] ?? job.template}
                </span>
                <StatusBadge status={job.status} />
                <span className="hidden w-28 text-left text-xs text-muted-foreground md:inline">
                  {formatDateTime(job.queuedAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            قبلی
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحه {page} از {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            بعدی
          </Button>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات ایمیل</DialogTitle>
          </DialogHeader>
          {!detail?.data ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <Row label="گیرنده" value={detail.data.to} />
              <Row label="موضوع" value={detail.data.subject} />
              <Row label="نوع" value={TEMPLATE_LABELS[detail.data.template] ?? detail.data.template} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">وضعیت</span>
                <StatusBadge status={detail.data.status} />
              </div>
              <Row label="تلاش‌ها" value={`${detail.data.attempts} / ${detail.data.maxAttempts}`} />
              <Row label="باز شده" value={`${detail.data.openCount} بار`} />
              <Row label="کلیک" value={`${detail.data.clickCount} بار`} />
              {detail.data.providerId && <Row label="شناسه ارسال" value={detail.data.providerId} mono />}
              <Row label="در صف از" value={formatDateTime(detail.data.queuedAt)} />
              {detail.data.deliveredAt && <Row label="تحویل" value={formatDateTime(detail.data.deliveredAt)} />}
              {detail.data.lastError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  <p className="text-xs font-semibold">آخرین خطا</p>
                  <p className="mt-1 break-all text-xs">{detail.data.lastError}</p>
                </div>
              )}

              {/* Lifecycle events */}
              {detail.data.events.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">رویدادها</p>
                  <div className="flex flex-col gap-1">
                    {detail.data.events.map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between text-xs">
                        <span className="font-mono">{ev.type}</span>
                        <span className="text-muted-foreground">{formatDateTime(ev.occurredAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {["FAILED", "BOUNCED"].includes(detail.data.status) && (
                <Button onClick={() => retry(detail.data.id)} disabled={retrying} className="mt-2">
                  {retrying ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                  تلاش مجدد
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`truncate text-left ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  )
}
