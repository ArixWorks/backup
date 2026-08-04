"use client"

import { use, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import Link from "next/link"
import { ChevronRight, Hourglass } from "lucide-react"
import { toast } from "sonner"
import { fetcher, apiPost } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { SignInRequired } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusChip } from "@/components/orders/status-chip"
import { RoadmapStepper } from "@/components/orders/roadmap-stepper"
import { CountdownTimer } from "@/components/orders/countdown-timer"
import { ExtensionPrompt } from "@/components/orders/extension-prompt"
import { NameserverManager } from "@/components/domains/nameserver-manager"
import { DomainLottie } from "@/components/domain-lottie"
import { useI18n } from "@/components/i18n-provider"
import { orderCopy } from "@/lib/i18n/order-copy"
import { DOMAIN_ORDER_COPY } from "@/lib/i18n/domain-order-copy"
import { formatToman, formatDateTime } from "@/lib/format"
import type { UserDomainOrderDetail } from "@/lib/orders/shared"

/** Statuses where the purchase hold is still active (timer + extension apply). */
const ACTIVE_HOLD = ["PENDING_PURCHASE", "PROCESSING", "AWAITING_EXTENSION_APPROVAL"]

export default function DomainOrderDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params)
  const { user } = useSession()
  const { locale } = useI18n()
  const c = orderCopy(locale)
  const dc = DOMAIN_ORDER_COPY[locale]
  const { mutate } = useSWRConfig()

  const key = user ? `/api/v1/domains/orders/${publicId}` : null
  const { data, isLoading } = useSWR<{ data: UserDomainOrderDetail }>(key, fetcher, { refreshInterval: 6000 })
  const order = data?.data

  const [busy, setBusy] = useState(false)

  if (!user) return <SignInRequired description={c.signInRequired} />

  async function refresh() {
    await Promise.all([mutate(key), mutate("/api/v1/orders")])
  }

  async function act(action: "approve-extension" | "reject-extension", payload?: Record<string, unknown>) {
    if (!order) return
    setBusy(true)
    try {
      await apiPost(`/api/v1/domains/orders/${order.publicId}/action`, { action, ...payload })
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : c.error)
    } finally {
      setBusy(false)
    }
  }

  const isActiveHold = order ? ACTIVE_HOLD.includes(order.status) : false
  const awaitingExtension = order?.status === "AWAITING_EXTENSION_APPROVAL"
  // Ring budget: the full hold window for this order (createdAt → holdExpiresAt).
  const totalSeconds =
    order?.holdExpiresAt
      ? Math.max(60, Math.round((new Date(order.holdExpiresAt).getTime() - new Date(order.createdAt).getTime()) / 1000))
      : 3600

  return (
    <div className="space-y-5">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4 ltr:rotate-180" />
        {c.back}
      </Link>

      {isLoading || !order ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Header with domain Lottie identity */}
          <header className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="hidden size-14 shrink-0 sm:block">
                  <DomainLottie />
                </div>
                <div className="min-w-0">
                  <h1 dir="ltr" className="text-left text-lg font-bold text-balance">
                    {order.domain}
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.codeLabel} {order.publicId} • {formatDateTime(order.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusChip status={order.status} />
                <span className="tabular-nums text-sm font-bold">
                  {order.amount > 0 ? `${formatToman(order.amount)} ${c.toman ?? ""}` : c.free}
                </span>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-sm sm:grid-cols-3">
              {order.purchasedAt && (
                <div>
                  <dt className="text-xs text-muted-foreground">{dc.purchased}</dt>
                  <dd className="mt-0.5 font-medium">{formatDateTime(order.purchasedAt)}</dd>
                </div>
              )}
              {order.expiresAt && (
                <div>
                  <dt className="text-xs text-muted-foreground">{dc.expires}</dt>
                  <dd className="mt-0.5 font-medium">{formatDateTime(order.expiresAt)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">{dc.amount}</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{formatToman(order.amount)}</dd>
              </div>
            </dl>
          </header>

          {/* Roadmap */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <RoadmapStepper steps={order.roadmap} />
          </section>

          {/* Timer + waiting/extension — only while the hold is active */}
          {isActiveHold && order.holdExpiresAt && (
            <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-sm font-bold text-muted-foreground">{dc.timerTitle}</h2>
              <CountdownTimer
                dueAt={order.holdExpiresAt}
                totalSeconds={totalSeconds}
                labels={{ remaining: dc.timeLeft, overdue: dc.overdue }}
              />
              {awaitingExtension && order.pendingExtensionMinutes ? (
                <div className="w-full">
                  <ExtensionPrompt
                    minutes={order.pendingExtensionMinutes}
                    refundAmountLabel={`${formatToman(order.amount)} ${c.toman ?? ""}`}
                    busy={busy}
                    onApprove={() => void act("approve-extension")}
                    onReject={(reasonCode, reason) => void act("reject-extension", { reasonCode, reason })}
                  />
                </div>
              ) : (
                <div className="flex w-full items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <h3 className="font-semibold">{dc.waitTitle}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{dc.waitBody}</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Always-on nameserver management */}
          <NameserverManager order={order} locale={locale} onChanged={refresh} />

          {/* Event timeline */}
          {order.events.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 text-sm font-bold text-muted-foreground">{c.timeline}</h2>
              <ol className="space-y-3">
                {order.events
                  .filter((e) => e.message)
                  .map((e, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <div>
                        <p dir="auto" className="text-pretty">
                          {e.message}
                        </p>
                        <time className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</time>
                      </div>
                    </li>
                  ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  )
}
