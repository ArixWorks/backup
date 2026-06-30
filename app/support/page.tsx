"use client"

import Link from "next/link"
import useSWR from "swr"
import { LifeBuoy, ChevronLeft, MessageSquare } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { EmptyState, SignInRequired } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { NewTicketDialog } from "@/components/support/new-ticket-dialog"
import { formatRelative } from "@/lib/format"
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

type Ticket = {
  id: string
  publicId: string
  subject: string
  category: SupportCategory
  status: SupportStatus
  lastReplyAt: string
  messageCount: number
}

export default function SupportPage() {
  const { user } = useSession()
  const { t } = useI18n()
  const { data, isLoading, mutate } = useSWR<{ data: Ticket[] }>(
    user ? "/api/v1/support" : null,
    fetcher,
  )

  const tickets = data?.data ?? []

  if (!user) {
    return <SignInRequired description={t("support.signInRequired")} />
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={LifeBuoy}
        title={t("support.title")}
        description={t("support.subtitle")}
        action={<NewTicketDialog onCreated={() => mutate()} />}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t("support.empty")}
          description={t("support.emptyDesc")}
        />
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/support/${ticket.publicId}`}
                className="active:scale-press flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span dir="auto" className="truncate font-bold">{ticket.subject}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${SUPPORT_STATUS_TONE[ticket.status]}`}>
                      {t(SUPPORT_STATUS_KEY[ticket.status])}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{t(SUPPORT_CAT_KEY[ticket.category])}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {ticket.messageCount}
                    </span>
                    <span>{formatRelative(ticket.lastReplyAt)}</span>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
