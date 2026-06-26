"use client"

import Link from "next/link"
import useSWR from "swr"
import { LifeBuoy, ChevronLeft, MessageSquare, Info } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { Skeleton } from "@/components/ui/skeleton"
import { NewTicketDialog } from "@/components/support/new-ticket-dialog"
import { formatRelative } from "@/lib/format"
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TONE,
  SUPPORT_CATEGORY_LABELS,
} from "@/lib/support-meta"

type Ticket = {
  id: string
  publicId: string
  subject: string
  category: keyof typeof SUPPORT_CATEGORY_LABELS
  status: keyof typeof SUPPORT_STATUS_LABELS
  lastReplyAt: string
  messageCount: number
}

export default function SupportPage() {
  const { user } = useSession()
  const { data, isLoading, mutate } = useSWR<{ data: Ticket[] }>(
    user ? "/api/v1/support" : null,
    fetcher,
  )

  const tickets = data?.data ?? []

  if (!user) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        برای استفاده از پشتیبانی ابتدا وارد شوید.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <LifeBuoy className="h-5 w-5 text-primary" />
            پشتیبانی و تیکت‌ها
          </h1>
          <p className="text-sm text-muted-foreground">سوال یا مشکلی دارید؟ تیکت بزنید تا بررسی کنیم.</p>
        </div>
        <NewTicketDialog onCreated={() => mutate()} />
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Info className="h-5 w-5" />
          هنوز تیکتی ثبت نکرده‌اید.
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/support/${t.publicId}`}
                className="active:scale-press flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-bold">{t.subject}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${SUPPORT_STATUS_TONE[t.status]}`}>
                      {SUPPORT_STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{SUPPORT_CATEGORY_LABELS[t.category]}</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {t.messageCount}
                    </span>
                    <span>{formatRelative(t.lastReplyAt)}</span>
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
