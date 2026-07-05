"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { LifeBuoy, Send, Loader2, ArrowRight, Paperclip } from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SUPPORT_STATUS_META, SUPPORT_CATEGORY_LABELS } from "@/lib/support-meta"
import { AiAssistPanel } from "@/components/admin/support/ai-assist-panel"

type TicketRow = {
  publicId: string
  subject: string
  category: keyof typeof SUPPORT_CATEGORY_LABELS
  status: keyof typeof SUPPORT_STATUS_META
  lastReplyAt: string
  messageCount: number
  user: { displayName: string; alias: string }
}
type Message = {
  id: string
  fromStaff: boolean
  body: string
  attachmentUrl: string | null
  createdAt: string
}
type TicketDetail = TicketRow & { messages: Message[] }

const filters = [
  { key: "", label: "همه" },
  { key: "OPEN", label: "باز" },
  { key: "PENDING", label: "در انتظار پاسخ" },
  { key: "ANSWERED", label: "پاسخ‌داده‌شده" },
  { key: "CLOSED", label: "بسته" },
] as const

export default function AdminSupportPage() {
  const [status, setStatus] = useState<string>("")
  const [selected, setSelected] = useState<string | null>(null)

  const { data, isLoading, mutate } = useSWR<{ data: TicketRow[] }>(
    `/api/v1/admin/support${status ? `?status=${status}` : ""}`,
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

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 text-sm">
        {filters.map((f) => (
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

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          تیکتی وجود ندارد.
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
  const { data, isLoading, mutate } = useSWR<{ data: TicketDetail }>(
    `/api/v1/admin/support/${publicId}`,
    fetcher,
    { refreshInterval: 12000 },
  )
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const ticket = data?.data

  async function reply(close?: boolean) {
    if (!body.trim()) return toast.error("متن پاسخ را وارد کنید")
    setSending(true)
    try {
      await apiPost(`/api/v1/admin/support/${publicId}`, { message: body.trim(), close })
      setBody("")
      toast.success(close ? "پاسخ ارسال و تیکت بسته شد" : "پاسخ ارسال شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ارسال پاسخ")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به فهرست تیکت‌ها
      </button>

      {isLoading || !ticket ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-balance text-lg font-extrabold">{ticket.subject}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ticket.user.displayName} ({ticket.user.alias}) · {SUPPORT_CATEGORY_LABELS[ticket.category]}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${SUPPORT_STATUS_META[ticket.status].className}`}>
                {SUPPORT_STATUS_META[ticket.status].label}
              </span>
            </div>
          </div>

          <ul className="space-y-3">
            {ticket.messages.map((m) => (
              <li key={m.id} className={`flex ${m.fromStaff ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl border p-3 ${
                    m.fromStaff ? "border-primary/30 bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-bold">{m.fromStaff ? "پشتیبانی" : "کاربر"}</span>
                    <span>{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                  {m.attachmentUrl && (
                    <a
                      href={m.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Paperclip className="h-3 w-3" />
                      مشاهده پیوست
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {ticket.status === "CLOSED" ? (
            <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              این تیکت بسته شده است.
            </div>
          ) : (
            <div className="space-y-3">
              <AiAssistPanel publicId={publicId} onUseDraft={setBody} />
              <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="پاسخ پشتیبانی…"
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background p-2.5 text-sm outline-none focus:border-primary/50"
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => reply(true)} disabled={sending}>
                  ارسال و بستن
                </Button>
                <Button onClick={() => reply(false)} disabled={sending} className="gap-1.5">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  ارسال پاسخ
                </Button>
              </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
