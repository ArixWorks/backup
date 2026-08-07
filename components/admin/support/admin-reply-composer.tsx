"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Send, CheckCircle2 } from "lucide-react"
import { apiPost, apiPatch, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RichContentEditor } from "@/components/rich-content"
import { AiAssistPanel } from "@/components/admin/support/ai-assist-panel"
import { STATUS_META } from "@/components/support/types"
import type { TicketStatus } from "@/components/support/types"

/** Statuses an admin can move a ticket into from the composer bar. */
const ASSIGNABLE_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "ANSWERED", "PENDING"]

/**
 * Strip HTML tags to a plain-text fallback stored as the message `body`
 * (used for previews, search, and non-HTML clients). The sanitized HTML is
 * kept separately as `bodyHtml`.
 */
function htmlToPlain(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  const el = document.createElement("div")
  el.innerHTML = html
  return (el.textContent || "").replace(/\s+/g, " ").trim()
}

export interface AdminReplyComposerProps {
  publicId: string
  status: TicketStatus
  /** Refetch the thread after any successful mutation. */
  onDone: () => void
}

/**
 * Admin-side rich reply bar: a TipTap editor (emits sanitized HTML), an AI
 * draft assistant, a live status selector, and send / send-and-close actions.
 */
export function AdminReplyComposer({ publicId, status, onDone }: AdminReplyComposerProps) {
  const [html, setHtml] = useState("")
  const [sending, setSending] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)

  async function changeStatus(next: TicketStatus) {
    if (next === status) return
    setStatusSaving(true)
    try {
      await apiPatch(`/api/v1/admin/support/${publicId}`, { status: next })
      toast.success(`وضعیت به «${STATUS_META[next].label}» تغییر کرد`)
      onDone()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در تغییر وضعیت")
    } finally {
      setStatusSaving(false)
    }
  }

  async function send(close?: boolean) {
    const plain = htmlToPlain(html)
    if (!plain) {
      toast.error("متن پاسخ را وارد کنید")
      return
    }
    setSending(true)
    try {
      await apiPost(`/api/v1/admin/support/${publicId}`, { message: plain, html, close })
      setHtml("")
      toast.success(close ? "پاسخ ارسال و تیکت بسته شد" : "پاسخ ارسال شد")
      onDone()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ارسال پاسخ")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <AiAssistPanel publicId={publicId} onUseDraft={setHtml} />

      <div className="rounded-2xl border border-border bg-card p-3">
        <RichContentEditor
          value={html}
          onChange={setHtml}
          placeholder="پاسخ پشتیبانی… برای دستورات «/» را بزنید"
          draftKey={`support-reply:${publicId}`}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">وضعیت</span>
            <Select value={status} onValueChange={(v) => changeStatus(v as TicketStatus)} disabled={statusSaving}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => send(true)} disabled={sending} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              ارسال و بستن
            </Button>
            <Button size="sm" onClick={() => send(false)} disabled={sending} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ارسال پاسخ
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
