"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { LifeBuoy, ArrowRight, Search, X } from "lucide-react"
import { fetcher, apiGet } from "@/lib/api-client"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { formatDateTime } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { SUPPORT_STATUS_META, SUPPORT_CATEGORY_LABELS } from "@/lib/support-meta"
import { ChatThreadLive } from "@/components/support/chat-thread"
import { AdminReplyComposer } from "@/components/admin/support/admin-reply-composer"
import { STATUS_META, CATEGORY_LABELS } from "@/components/support/types"
import type { TicketStatus, TicketCategory } from "@/components/support/types"

type TicketRow = {
  publicId: string
  subject: string
  category: keyof typeof SUPPORT_CATEGORY_LABELS
  status: keyof typeof SUPPORT_STATUS_META
  lastReplyAt: string
  messageCount: number
  user: { displayName: string; alias: string }
}

const statusFilters = [
  { key: "", label: "همه" },
  { key: "OPEN", label: "باز" },
  { key: "IN_PROGRESS", label: "در حال بررسی" },
  { key: "PENDING", label: "در انتظار پاسخ" },
  { key: "ANSWERED", label: "پاسخ‌داده‌شده" },
  { key: "CLOSED", label: "بسته" },
] as const

const categoryFilters = [
  { key: "", label: "همه دسته‌ها" },
  { key: "GENERAL", label: "عمومی" },
  { key: "PAYMENT", label: "پرداخت" },
  { key: "ORDER", label: "سفارش" },
  { key: "REFUND", label: "بازگشت وجه" },
  { key: "TECHNICAL", label: "فنی" },
] as const

export default function AdminSupportPage() {
  const [status, setStatus] = useState<string>("")
  const [category, setCategory] = useState<string>("")
  const [q, setQ] = useState("")
  const debouncedQ = useDebouncedValue(q, 350)
  const [selected, setSelected] = useState<string | null>(null)

  const query = useMemo(() => {
    const sp = new URLSearchParams()
    if (status) sp.set("status", status)
    if (category) sp.set("category", category)
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim())
    const s = sp.toString()
    return s ? `?${s}` : ""
  }, [status, category, debouncedQ])

  const { data, isLoading, mutate } = useSWR<{ data: TicketRow[] }>(
    `/api/v1/admin/support${query}`,
    fetcher,
    { refreshInterval: 12000 },
  )
  const rows = data?.data ?? []

  if (selected) {
    return (
      <AdminTicketThread
        publicId={selected}
        onBack={() => {
          setSelected(null)
          mutate()
        }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <LifeBuoy className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">تیکت‌های پشتیبانی</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو در موضوع، نام کاربر یا متن پیام…"
          className="pr-9"
          aria-label="جستجوی تیکت"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="پاک‌کردن جستجو"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 text-sm">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              status === f.key
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {categoryFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setCategory(f.key)}
            className={`rounded-full border px-3 py-1 transition-colors ${
              category === f.key
                ? "border-primary/50 bg-primary/10 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {debouncedQ ? "تیکتی با این جستجو یافت نشد." : "تیکتی وجود ندارد."}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((t) => {
            const meta = SUPPORT_STATUS_META[t.status]
            return (
              <li key={t.publicId}>
                <button
                  onClick={() => setSelected(t.publicId)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-right transition-colors hover:border-primary/40"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.className}`}>
                        {meta.label}
                      </span>
                      <span className="truncate text-sm font-bold">{t.subject}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{t.user.displayName}</span>
                      <span aria-hidden>•</span>
                      <span>{SUPPORT_CATEGORY_LABELS[t.category]}</span>
                      <span aria-hidden>•</span>
                      <span className="tabular-nums">{t.messageCount} پیام</span>
                      <span aria-hidden>•</span>
                      <span>{formatDateTime(t.lastReplyAt)}</span>
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function AdminTicketThread({ publicId, onBack }: { publicId: string; onBack: () => void }) {
  const { data: session } = useSWR<{ data?: { id: string } }>("/api/v1/auth/session", apiGet)
  const myUserId = session?.data?.id ?? ""

  const { data } = useSWR<{ data: { subject: string; status: TicketStatus; category: TicketCategory; user: { displayName: string; alias: string } } }>(
    `/api/v1/admin/support/${publicId}`,
    fetcher,
    { refreshInterval: 15000 },
  )
  const ticket = data?.data

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3">
      <div className="flex items-start gap-2">
        <button
          onClick={onBack}
          aria-label="بازگشت به فهرست تیکت‌ها"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-extrabold leading-tight">
            {ticket?.subject ?? "در حال بارگذاری…"}
          </h2>
          {ticket && (
            <p className="text-xs text-muted-foreground">
              {ticket.user.displayName} ({ticket.user.alias}) · {CATEGORY_LABELS[ticket.category]}
            </p>
          )}
        </div>
        {ticket && (
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_META[ticket.status].className}`}>
            {STATUS_META[ticket.status].label}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
        {!ticket || !myUserId ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <ChatThreadLive
            threadUrl={`/api/v1/admin/support/${publicId}`}
            myUserId={myUserId}
            role="admin"
            closed={ticket.status === "CLOSED"}
            renderComposer={(onDone) => (
              <AdminReplyComposer publicId={publicId} status={ticket.status} onDone={onDone} />
            )}
          />
        )}
      </div>
    </div>
  )
}
