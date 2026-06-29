"use client"

import { use, useRef, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ArrowRight,
  Loader2,
  Send,
  Paperclip,
  X,
  CheckCircle2,
  Headset,
  User as UserIcon,
} from "lucide-react"
import { fetcher, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { uploadFile } from "@/lib/upload-client"
import { formatDateTime } from "@/lib/format"
import { SUPPORT_STATUS_TONE } from "@/lib/support-meta"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

type SupportStatus = "OPEN" | "ANSWERED" | "PENDING" | "CLOSED"
type SupportCategory = "GENERAL" | "PAYMENT" | "ORDER" | "REFUND" | "TECHNICAL"

const SUPPORT_STATUS_KEY: Record<SupportStatus, MessageKey> = {
  OPEN: "supportStatus.OPEN",
  ANSWERED: "supportStatus.ANSWERED",
  PENDING: "supportStatus.PENDING",
  CLOSED: "supportStatus.CLOSED",
}

const SUPPORT_CAT_KEY: Record<SupportCategory, MessageKey> = {
  GENERAL: "supportCat.GENERAL",
  PAYMENT: "supportCat.PAYMENT",
  ORDER: "supportCat.ORDER",
  REFUND: "supportCat.REFUND",
  TECHNICAL: "supportCat.TECHNICAL",
}

type Message = {
  id: string
  body: string
  fromStaff: boolean
  attachmentUrl: string | null
  createdAt: string
}

type Ticket = {
  id: string
  publicId: string
  subject: string
  category: SupportCategory
  status: SupportStatus
  messages: Message[]
}

export default function TicketThreadPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { t } = useI18n()
  const { publicId } = use(params)
  const { data, isLoading, mutate } = useSWR<{ data: Ticket }>(
    `/api/v1/support/${publicId}`,
    fetcher,
    { refreshInterval: 8000 },
  )

  const [reply, setReply] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const ticket = data?.data
  const closed = ticket?.status === "CLOSED"

  async function send() {
    if (reply.trim().length < 1) return
    setBusy(true)
    try {
      let attachmentUrl: string | undefined
      if (file) attachmentUrl = await uploadFile(file, "tickets")
      await apiPost(`/api/v1/support/${publicId}`, { message: reply, attachmentUrl })
      setReply("")
      setFile(null)
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("ticket.errSend"))
    } finally {
      setBusy(false)
    }
  }

  async function closeTicket() {
    try {
      await apiDelete(`/api/v1/support/${publicId}`)
      toast.success(t("ticket.closedToast"))
      await mutate()
    } catch {
      toast.error(t("ticket.errClose"))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/support"
          aria-label={t("ticket.back")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold">
          {ticket?.subject ?? t("ticket.fallbackTitle")}
        </h1>
        {ticket && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${SUPPORT_STATUS_TONE[ticket.status]}`}>
            {t(SUPPORT_STATUS_KEY[ticket.status])}
          </span>
        )}
      </div>

      {isLoading || !ticket ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {t("ticket.category")} {t(SUPPORT_CAT_KEY[ticket.category])}
          </div>

          <ul className="space-y-3">
            {ticket.messages.map((m) => (
              <li key={m.id} className={`flex gap-2 ${m.fromStaff ? "" : "flex-row-reverse"}`}>
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    m.fromStaff ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.fromStaff ? <Headset className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                </span>
                <div
                  className={`max-w-[80%] rounded-2xl border px-3 py-2 ${
                    m.fromStaff
                      ? "border-primary/20 bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-pretty">{m.body}</p>
                  {m.attachmentUrl && (
                    <a
                      href={m.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline"
                    >
                      <Paperclip className="h-3 w-3" />
                      {t("ticket.viewAttachment")}
                    </a>
                  )}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {formatDateTime(m.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {closed ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              {t("ticket.closedNotice")}
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder={t("ticket.replyPlaceholder")}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                    <Paperclip className="h-4 w-4" />
                    {t("ticket.attach")}
                  </Button>
                  {file && (
                    <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                      <span className="max-w-28 truncate">{file.name}</span>
                      <button type="button" onClick={() => setFile(null)} aria-label={t("ticket.removeAttach")}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={closeTicket}>
                    {t("ticket.closeTicket")}
                  </Button>
                  <Button onClick={send} disabled={busy} size="sm" className="gap-1.5">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {t("ticket.send")}
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
