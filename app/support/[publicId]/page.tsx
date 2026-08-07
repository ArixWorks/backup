"use client"

import { use, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import { ArrowRight, MoreVertical, CheckCircle2 } from "lucide-react"
import { fetcher, apiGet, apiPost, apiDelete } from "@/lib/api-client"
import type { UploadedAttachment } from "@/lib/upload-client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SUPPORT_STATUS_TONE } from "@/lib/support-meta"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"
import { ChatThreadLive } from "@/components/support/chat-thread"
import type { TicketStatus, TicketCategory } from "@/components/support/types"

const SUPPORT_STATUS_KEY: Record<TicketStatus, MessageKey> = {
  OPEN: "supportStatus.OPEN",
  IN_PROGRESS: "supportStatus.IN_PROGRESS",
  ANSWERED: "supportStatus.ANSWERED",
  PENDING: "supportStatus.PENDING",
  CLOSED: "supportStatus.CLOSED",
}

const SUPPORT_CAT_KEY: Record<TicketCategory, MessageKey> = {
  GENERAL: "supportCat.GENERAL",
  PAYMENT: "supportCat.PAYMENT",
  ORDER: "supportCat.ORDER",
  REFUND: "supportCat.REFUND",
  TECHNICAL: "supportCat.TECHNICAL",
}

export default function TicketThreadPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { t, errorMessage } = useI18n()
  const { publicId } = use(params)

  // Header ticket meta (subject/status/category). The thread body polls itself.
  const { data, isLoading, mutate } = useSWR<{ data: { subject: string; status: TicketStatus; category: TicketCategory } }>(
    `/api/v1/support/${publicId}`,
    fetcher,
    { refreshInterval: 15000 },
  )
  // Current user id for reaction ownership + bubble alignment. apiGet returns
  // the raw `{ ok, data }` envelope, so the user record is under `.data`.
  const { data: session } = useSWR<{ data?: { id: string } }>("/api/v1/auth/session", apiGet)
  const myUserId = session?.data?.id ?? ""

  const ticket = data?.data
  const closed = ticket?.status === "CLOSED"

  async function closeTicket() {
    try {
      await apiDelete(`/api/v1/support/${publicId}`)
      toast.success(t("ticket.closedToast"))
      await mutate()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/support"
          aria-label={t("ticket.back")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 dir="auto" className="truncate text-base font-extrabold leading-tight">
            {ticket?.subject ?? t("ticket.fallbackTitle")}
          </h1>
          {ticket && (
            <p className="text-xs text-muted-foreground">
              {t("ticket.category")} {t(SUPPORT_CAT_KEY[ticket.category])}
            </p>
          )}
        </div>
        {ticket && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${SUPPORT_STATUS_TONE[ticket.status]}`}>
            {t(SUPPORT_STATUS_KEY[ticket.status])}
          </span>
        )}
        {ticket && !closed && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t("ticket.actions")}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={closeTicket}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t("ticket.closeTicket")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Thread */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
        {isLoading || !ticket || !myUserId ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <ChatThreadLive
            threadUrl={`/api/v1/support/${publicId}`}
            myUserId={myUserId}
            role="user"
            onSend={async (message: string, attachments: UploadedAttachment[]) => {
              await apiPost(`/api/v1/support/${publicId}`, { message, attachments })
            }}
          />
        )}
      </div>
    </div>
  )
}
