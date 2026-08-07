"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { Check, CheckCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiGet, apiPost } from "@/lib/api-client"
import { formatDateTime, formatRelative } from "@/lib/format"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { AttachmentPreview } from "./attachment-preview"
import { MessageReactions } from "./message-reactions"
import { MessageBody } from "./message-body"
import { ChatComposer } from "./chat-composer"
import type { UploadedAttachment } from "@/lib/upload-client"
import type { ReactionType } from "./message-reactions"
import type { TicketMessageDTO } from "./types"

/**
 * Shared conversation view used by BOTH the user and admin ticket pages.
 * `role` flips perspective: which side sits right (self), whether staff HTML
 * is composed, and whether read-receipts are automatic (user) or manual (admin).
 */
export interface ChatThreadProps {
  /** API base for this thread, e.g. `/api/v1/support/tk_x` or admin variant. */
  threadUrl: string
  /** Current viewer id, for reaction ownership + bubble alignment. */
  myUserId: string
  role: "user" | "admin"
  messages: TicketMessageDTO[]
  /** Whether the ticket is closed (disables the composer). */
  closed?: boolean
  /** Called after any mutation so the parent can refetch the thread. */
  onRefresh: () => void
  /** Sends a message (+ attachments) — supplied by each page's own endpoint. */
  onSend: (message: string, attachments: UploadedAttachment[]) => Promise<void>
}

export function ChatThread({ threadUrl, myUserId, role, messages, closed, onRefresh, onSend }: ChatThreadProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Track which message ids we've already rendered so the typing effect only
  // plays once, when a staff message first arrives — never on every poll.
  const seenIds = useRef<Set<string>>(new Set())
  const [animateId, setAnimateId] = useState<string | null>(null)

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  // Detect a freshly-arrived staff message (user perspective) to animate.
  useEffect(() => {
    const known = seenIds.current
    const first = known.size === 0
    let fresh: string | null = null
    const last = messages[messages.length - 1]
    if (last && !known.has(last.id) && role === "user" && last.fromStaff && !last.isSystem && !first) {
      fresh = last.id
    }
    for (const m of messages) known.add(m.id)
    if (fresh) setAnimateId(fresh)
  }, [messages, role])

  async function react(messageId: string, type: ReactionType) {
    await apiPost(`/api/v1/support/messages/${messageId}/reaction`, { type })
    onRefresh()
  }

  async function markRead(messageId: string) {
    await apiPost(`/api/v1/admin/support/messages/${messageId}/read`, {})
    onRefresh()
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.map((m) => {
          if (m.isSystem) {
            return (
              <div key={m.id} className="flex justify-center">
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{m.body}</span>
              </div>
            )
          }
          // "self" = the current viewer's own side. For a user, their own
          // messages (fromStaff=false) sit right; for admin, staff messages sit right.
          const self = role === "admin" ? m.fromStaff : !m.fromStaff
          // Read tick shows on the viewer's own outgoing messages.
          const showReadTick = self

          return (
            <div key={m.id} className={cn("flex gap-2", self ? "flex-row-reverse" : "flex-row")}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback
                  className={cn("text-[10px]", m.fromStaff ? "bg-violet-500/20 text-violet-200" : "bg-sky-500/20 text-sky-200")}
                >
                  {m.fromStaff ? "PS" : "You"}
                </AvatarFallback>
              </Avatar>

              <div className={cn("group flex max-w-[80%] flex-col", self ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "relative rounded-2xl px-4 py-2.5 shadow-sm",
                    // Distinct colors per side so the two parties are unmistakable.
                    self ? "rounded-br-md bg-violet-600 text-white" : "rounded-bl-md bg-muted text-foreground",
                  )}
                >
                  <MessageBody body={m.body} html={m.bodyHtml} animate={animateId === m.id} />
                  <AttachmentPreview attachments={m.attachments} />
                </div>

                <div className={cn("mt-1 flex items-center gap-2 px-1", self ? "flex-row-reverse" : "flex-row")}>
                  <time
                    className="text-[11px] text-muted-foreground"
                    dateTime={m.createdAt}
                    title={formatDateTime(m.createdAt)}
                  >
                    {formatRelative(m.createdAt)}
                  </time>

                  {/* Read receipt: two ticks when read, one when delivered. */}
                  {showReadTick &&
                    (m.readAt ? (
                      <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="خوانده شد" />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-muted-foreground" aria-label="ارسال شد" />
                    ))}

                  {/* Admin manual read button on a user's message. */}
                  {role === "admin" && !m.fromStaff && !m.readAt && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      title="علامت‌گذاری به‌عنوان خوانده‌شده برای کاربر"
                      onClick={() => markRead(m.id)}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <MessageReactions
                  reactions={m.reactions}
                  myUserId={myUserId}
                  onReact={(type) => react(m.id, type)}
                  align={self ? "end" : "start"}
                />
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <div className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
          این گفتگو بسته شده است.
        </div>
      ) : (
        <div className="px-3 pb-3">
          <ChatComposer onSend={onSend} />
        </div>
      )}
    </div>
  )
}

/**
 * SWR-driven wrapper: polls the thread and passes messages down. Accepts either
 * a bare `{ messages }` payload or the app's standard `{ data: { messages } }`
 * envelope. Notifies the parent of ticket status on each poll.
 */
export function ChatThreadLive(
  props: Omit<ChatThreadProps, "messages" | "onRefresh"> & {
    onTicket?: (t: { status?: string; messages: TicketMessageDTO[] }) => void
  },
) {
  const { data, mutate } = useSWR<Record<string, unknown>>(props.threadUrl, apiGet, { refreshInterval: 8000 })
  const ticket = ((data?.data ?? data) ?? {}) as { status?: string; messages?: TicketMessageDTO[] }
  const messages = ticket.messages ?? []
  const { onTicket } = props
  useEffect(() => {
    if (data) onTicket?.({ status: ticket.status, messages })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
  return <ChatThread {...props} messages={messages} closed={props.closed ?? ticket.status === "CLOSED"} onRefresh={() => mutate()} />
}
