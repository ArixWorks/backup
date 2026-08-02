"use client"

import { use } from "react"
import useSWR, { useSWRConfig } from "swr"
import Link from "next/link"
import { ChevronRight, BookOpen, CheckCircle2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { fetcher, apiPost } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { SignInRequired } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusChip } from "@/components/orders/status-chip"
import { RoadmapStepper } from "@/components/orders/roadmap-stepper"
import { CountdownTimer } from "@/components/orders/countdown-timer"
import { CustomerInputForm } from "@/components/orders/customer-input-form"
import { ExtensionPrompt } from "@/components/orders/extension-prompt"
import { CredentialFields } from "@/components/delivery/credential-fields"
import { TwoFactorCode } from "@/components/delivery/two-factor-code"
import { useI18n } from "@/components/i18n-provider"
import { orderCopy } from "@/lib/i18n/order-copy"
import { formatToman, formatDateTime } from "@/lib/format"
import type { OrderDetail } from "@/lib/orders/shared"
import { useState } from "react"

export default function OrderDetailPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = use(params)
  const { user } = useSession()
  const { locale } = useI18n()
  const c = orderCopy(locale)
  const { mutate } = useSWRConfig()
  const [busy, setBusy] = useState(false)

  const key = user ? `/api/v1/orders/${publicId}` : null
  const { data, isLoading } = useSWR<{ data: OrderDetail }>(key, fetcher, { refreshInterval: 6000 })
  const order = data?.data

  if (!user) return <SignInRequired description={c.signInRequired} />

  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      await mutate(key)
      await mutate("/api/v1/orders")
      toast.success(c.saved)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : c.error)
    } finally {
      setBusy(false)
    }
  }

  const submitInput = (values: Record<string, string>) =>
    act(() => apiPost(`/api/v1/orders/${publicId}/customer-input`, { values }))
  const approveExt = () => act(() => apiPost(`/api/v1/orders/${publicId}/extension`, { action: "approve" }))
  const rejectExt = (reasonCode: string, reason: string) =>
    act(() => apiPost(`/api/v1/orders/${publicId}/cancel`, { reasonCode, reason }))

  return (
    <div className="space-y-5">
      {/* back link */}
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4 ltr:rotate-180" />
        {c.back}
      </Link>

      {isLoading || !order ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* header */}
          <header className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 dir="auto" className="text-lg font-bold text-balance">
                  {order.title}
                </h1>
                {order.variantName && <p className="text-sm text-muted-foreground">{order.variantName}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.codeLabel} {order.publicId} • {formatDateTime(order.createdAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusChip status={order.status} />
                <span className="tabular-nums text-sm font-bold">
                  {order.amount > 0 ? `${formatToman(order.amount)} ${c.toman ?? ""}` : c.free}
                </span>
              </div>
            </div>
          </header>

          <div className="grid gap-4 web:lg:grid-cols-[1fr_1.2fr]">
            {/* roadmap */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-bold text-muted-foreground">{c.timeline}</h2>
              <RoadmapStepper steps={order.roadmap} />
            </section>

            {/* contextual action panel */}
            <section className="space-y-4">
              <ActionPanel
                order={order}
                busy={busy}
                onSubmitInput={submitInput}
                onApprove={approveExt}
                onReject={rejectExt}
              />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function ActionPanel({
  order,
  busy,
  onSubmitInput,
  onApprove,
  onReject,
}: {
  order: OrderDetail
  busy: boolean
  onSubmitInput: (v: Record<string, string>) => void
  onApprove: () => void
  onReject: (code: string, reason: string) => void
}) {
  const { locale } = useI18n()
  const c = orderCopy(locale)
  const isComplete = order.status === "DELIVERED" || order.status === "COMPLETED"
  const isCancelled = order.status === "REFUNDED" || order.status === "CANCELLED"

  return (
    <>
      {/* 1) Awaiting customer input */}
      {order.status === "AWAITING_CUSTOMER_INPUT" && order.customerInputTemplate && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-bold">{c.inputTitle}</h2>
          <CustomerInputForm template={order.customerInputTemplate} onSubmit={onSubmitInput} submitting={busy} />
        </div>
      )}

      {/* 2) Processing — live countdown */}
      {order.status === "PROCESSING" && order.dueAt && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-bold">{c.timerTitle}</h2>
          <CountdownTimer
            dueAt={order.dueAt}
            totalSeconds={(order.estimatedMinutes ?? 10) * 60}
            labels={{ remaining: c.timeLeft, overdue: c.overdue }}
          />
          {new Date(order.dueAt).getTime() < Date.now() && (
            <p className="text-center text-xs text-muted-foreground text-pretty">{c.overdueDesc}</p>
          )}
        </div>
      )}

      {/* 3) Awaiting extension approval */}
      {order.status === "AWAITING_EXTENSION_APPROVAL" && order.pendingExtensionMinutes && (
        <ExtensionPrompt
          minutes={order.pendingExtensionMinutes}
          refundAmountLabel={`${formatToman(order.amount)} ${c.toman ?? ""}`}
          onApprove={onApprove}
          onReject={onReject}
          busy={busy}
        />
      )}

      {/* Submitted info echo (owner-only, masked) */}
      {order.customerInputSubmitted && order.customerInputValues && !isCancelled && (
        <CredentialFields
          payload={order.customerInputValues}
          template={order.customerInputTemplate}
          title={c.inputYourData}
        />
      )}

      {/* 4) Completed */}
      {isComplete && (
        <div className="space-y-4 rounded-2xl border border-success/30 bg-success/5 p-5">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="font-bold">{c.completionTitle}</h2>
          </div>
          {order.completionNote && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{c.completionNote}</p>
              <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed">
                {order.completionNote}
              </p>
            </div>
          )}
          {order.delivery?.payload && (
            <CredentialFields payload={order.delivery.payload} template={order.delivery.template} title={c.deliveryInfo} />
          )}
          {order.delivery?.has2fa && order.delivery.id && <TwoFactorCode deliveryId={order.delivery.id} />}
          {order.completionTutorial && (
            <Link
              href={order.completionTutorial.href}
              className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {c.tutorial}: {order.completionTutorial.title}
              </span>
              <ChevronRight className="h-4 w-4 ltr:rotate-180" aria-hidden />
            </Link>
          )}
        </div>
      )}

      {/* 5) Cancelled / refunded */}
      {isCancelled && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RotateCcw className="h-5 w-5" />
            <h2 className="font-bold">{c.statuses[order.status]}</h2>
          </div>
          {order.cancelReasonCode && (
            <p className="mt-2 text-sm text-muted-foreground">{c.reasons[order.cancelReasonCode] ?? order.cancelReason}</p>
          )}
          {order.refundedAmount != null && order.refundedAmount > 0 && (
            <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success">
              {c.refundNote(`${formatToman(order.refundedAmount)} ${c.toman ?? ""}`)}
            </p>
          )}
        </div>
      )}

      {/* event timeline */}
      {order.events.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
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
        </div>
      )}
    </>
  )
}
