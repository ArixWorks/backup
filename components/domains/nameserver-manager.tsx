"use client"

import { useState } from "react"
import { Globe2, Loader2, CheckCircle2, Lock, Clock, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { apiPost } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { DOMAIN_ORDER_COPY } from "@/lib/i18n/domain-order-copy"
import { formatDateTime } from "@/lib/format"
import { NS_REQUEST_TONE } from "@/lib/orders/shared"
import type { NsRequestView, UserDomainOrderDetail } from "@/lib/orders/shared"

const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\.?$/i

/**
 * Always-on nameserver management for a domain order. Once the domain is owned
 * (registered) the buyer can submit or change NS at any time; each submission
 * creates a fresh admin-approved change request. Before registration the whole
 * section is locked with an explanatory state. Shows the live NS on the domain
 * plus the full request history with per-status tone.
 */
export function NameserverManager({
  order,
  locale,
  onChanged,
}: {
  order: UserDomainOrderDetail
  locale: keyof typeof DOMAIN_ORDER_COPY
  onChanged: () => void | Promise<unknown>
}) {
  const dc = DOMAIN_ORDER_COPY[locale]
  const [ns, setNs] = useState({
    ns1: order.liveNameservers[0] ?? "",
    ns2: order.liveNameservers[1] ?? "",
    ns3: order.liveNameservers[2] ?? "",
    ns4: order.liveNameservers[3] ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Locked until the domain is registered.
  if (!order.isOwned) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5" aria-label={dc.nsAria}>
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <h2 className="font-bold">{dc.nsLockedTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{dc.nsLockedBody}</p>
          </div>
        </div>
      </section>
    )
  }

  async function submit() {
    const values = Object.values(ns).map((v) => v.trim().toLowerCase()).filter(Boolean)
    let err: string | null = null
    if (!ns.ns1.trim() || !ns.ns2.trim()) err = dc.nsRequired
    else if (values.some((v) => !HOSTNAME.test(v))) err = dc.nsInvalid
    else if (new Set(values.map((v) => v.replace(/\.$/, ""))).size !== values.length) err = dc.nsUnique
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await apiPost("/api/v1/domains/orders", { orderId: order.publicId, ...ns })
      toast.success(dc.nsSaved)
      await onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : dc.nsFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const hasPending = order.nsRequests.some((r) => r.status === "PENDING")

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-5" aria-label={dc.nsAria}>
      <div>
        <h2 className="font-bold">{dc.nsTitle}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{dc.nsDescription}</p>
      </div>

      {/* Live nameservers on the domain */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
          <h3 className="text-sm font-semibold">{dc.liveNsTitle}</h3>
        </div>
        {order.liveNameservers.length > 0 ? (
          <>
            <div dir="ltr" className="mt-3 grid gap-2 text-left font-mono text-sm sm:grid-cols-2">
              {order.liveNameservers.map((n) => (
                <span key={n} className="rounded-lg bg-secondary p-2">
                  {n}
                </span>
              ))}
            </div>
            {order.nsUpdatedAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                {dc.nsUpdatedAt}: {formatDateTime(order.nsUpdatedAt)}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{dc.noLiveNs}</p>
        )}
      </div>

      {/* Submit / change form */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(["ns1", "ns2", "ns3", "ns4"] as const).map((k, i) => (
          <label key={k} className="flex flex-col gap-2 text-sm font-medium">
            <span>
              NS{i + 1}
              {i < 2 && <span className="ms-1 text-destructive">{dc.required}</span>}
            </span>
            <Input
              dir="ltr"
              className="text-left"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder={`ns${i + 1}.example.com`}
              value={ns[k]}
              aria-invalid={Boolean(error)}
              onChange={(e) => {
                setNs((cur) => ({ ...cur, [k]: e.target.value }))
                if (error) setError(null)
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm leading-relaxed text-destructive">
          {error}
        </p>
      )}
      <Button className="w-full sm:w-fit" onClick={() => void submit()} disabled={submitting || !ns.ns1.trim() || !ns.ns2.trim()}>
        {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Globe2 data-icon="inline-start" />}
        {dc.nsSubmit}
      </Button>

      {/* Request history */}
      {order.nsRequests.length > 0 && (
        <div className="border-t border-border/60 pt-4">
          <h3 className="mb-3 text-sm font-bold text-muted-foreground">{dc.nsHistoryTitle}</h3>
          <ol className="space-y-3">
            {order.nsRequests.map((r) => (
              <NsRequestRow key={r.id} req={r} dc={dc} highlightPending={hasPending} />
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function NsRequestRow({
  req,
  dc,
  highlightPending,
}: {
  req: NsRequestView
  dc: (typeof DOMAIN_ORDER_COPY)[keyof typeof DOMAIN_ORDER_COPY]
  highlightPending: boolean
}) {
  const tone = NS_REQUEST_TONE[req.status] ?? "neutral"
  const label =
    req.status === "PENDING"
      ? dc.nsReqPending
      : req.status === "COMPLETED"
        ? dc.nsReqCompleted
        : req.status === "REJECTED"
          ? dc.nsReqRejected
          : dc.nsReqCancelled
  const Icon = req.status === "COMPLETED" ? CheckCircle2 : req.status === "REJECTED" ? XCircle : Clock
  return (
    <li
      className={cn(
        "rounded-xl border p-3",
        tone === "warning" && highlightPending
          ? "border-warning/40 bg-warning/5"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-semibold",
            tone === "success" && "text-success",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-destructive",
            tone === "neutral" && "text-muted-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </span>
        <time className="text-xs text-muted-foreground">{formatDateTime(req.requestedAt)}</time>
      </div>
      <div dir="ltr" className="mt-2 grid gap-1.5 text-left font-mono text-xs sm:grid-cols-2">
        {req.nameservers.map((n) => (
          <span key={n} className="rounded-md bg-secondary px-2 py-1">
            {n}
          </span>
        ))}
      </div>
      {req.status === "REJECTED" && req.note && (
        <p className="mt-2 text-xs text-destructive">
          {dc.nsReqRejectReason}: {req.note}
        </p>
      )}
    </li>
  )
}
