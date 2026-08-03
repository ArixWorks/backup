"use client"

import { use, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import Link from "next/link"
import { ChevronRight, Globe2, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { fetcher, apiPost } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { SignInRequired } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { StatusChip } from "@/components/orders/status-chip"
import { useI18n } from "@/components/i18n-provider"
import { orderCopy } from "@/lib/i18n/order-copy"
import { DOMAIN_ORDER_COPY } from "@/lib/i18n/domain-order-copy"
import { formatToman, formatDateTime } from "@/lib/format"
import type { UserDomainOrderDetail } from "@/lib/orders/shared"

const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\.?$/i

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

  const [ns, setNs] = useState({ ns1: "", ns2: "", ns3: "", ns4: "" })
  const [nsError, setNsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Prefill from the order once, when it first loads.
  if (order && !hydrated) {
    setNs({ ns1: order.ns1 ?? "", ns2: order.ns2 ?? "", ns3: order.ns3 ?? "", ns4: order.ns4 ?? "" })
    setHydrated(true)
  }

  if (!user) return <SignInRequired description={c.signInRequired} />

  async function submitNameservers() {
    if (!order) return
    const values = Object.values(ns).map((v) => v.trim().toLowerCase()).filter(Boolean)
    let error: string | null = null
    if (!ns.ns1.trim() || !ns.ns2.trim()) error = dc.nsRequired
    else if (values.some((v) => !HOSTNAME.test(v))) error = dc.nsInvalid
    else if (new Set(values.map((v) => v.replace(/\.$/, ""))).size !== values.length) error = dc.nsUnique
    if (error) {
      setNsError(error)
      return
    }
    setNsError(null)
    setSubmitting(true)
    try {
      await apiPost("/api/v1/domains/orders", { orderId: order.id, ...ns })
      toast.success(dc.nsSaved)
      await mutate(key)
      await mutate("/api/v1/orders")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : dc.nsFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const submittedNs = order ? [order.ns1, order.ns2, order.ns3, order.ns4].filter(Boolean) : []

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
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* header */}
          <header className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 dir="ltr" className="text-left text-lg font-bold text-balance">
                  {order.domain}
                </h1>
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

            {/* key dates */}
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

          {/* NS entry — buyer action */}
          {order.status === "AWAITING_NAMESERVERS" && (
            <section
              className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-5"
              aria-label={dc.nsAria}
            >
              <div>
                <h2 className="font-bold">{dc.nsTitle}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{dc.nsDescription}</p>
              </div>
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
                      aria-invalid={Boolean(nsError)}
                      onChange={(e) => {
                        setNs((cur) => ({ ...cur, [k]: e.target.value }))
                        if (nsError) setNsError(null)
                      }}
                    />
                  </label>
                ))}
              </div>
              {nsError && (
                <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm leading-relaxed text-destructive">
                  {nsError}
                </p>
              )}
              <Button
                className="w-full sm:w-fit"
                onClick={() => void submitNameservers()}
                disabled={submitting || !ns.ns1.trim() || !ns.ns2.trim()}
              >
                {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Globe2 data-icon="inline-start" />}
                {dc.nsSubmit}
              </Button>
            </section>
          )}

          {/* NS submitted / configured — read-only display */}
          {submittedNs.length > 0 && order.status !== "AWAITING_NAMESERVERS" && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                {order.status === "COMPLETED" && <CheckCircle2 className="h-5 w-5 text-success" />}
                <h2 className="font-bold">{dc.nsSent}</h2>
              </div>
              <div dir="ltr" className="mt-3 grid gap-2 text-left font-mono text-sm sm:grid-cols-2">
                {submittedNs.map((n) => (
                  <span key={n as string} className="rounded-lg bg-secondary p-2">
                    {n}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* event timeline */}
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
