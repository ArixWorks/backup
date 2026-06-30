"use client"

import useSWR from "swr"
import { Package, Gavel, Zap, CheckCircle2, Clock, XCircle, RotateCcw, ShoppingBag } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { EmptyState, SignInRequired } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { formatToman, formatDateTime, formatNumber } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

type Order = {
  id: string
  publicId: string
  title: string
  type: string
  status: string
  amount: number
  quantity: number
  createdAt: string
  delivery: {
    method: string
    status: string
    payload: Record<string, unknown> | string | null
    error: string | null
  } | null
}

const payloadLabels: Record<string, MessageKey> = {
  username: "payload.username",
  password: "payload.password",
  email: "payload.email",
  licenseKey: "payload.licenseKey",
  code: "payload.code",
  note: "payload.note",
  url: "payload.url",
}

function DeliveryPayload({ payload }: { payload: Record<string, unknown> | string }) {
  const { t } = useI18n()
  if (typeof payload === "string") {
    return (
      <pre className="overflow-x-auto rounded-lg border border-border bg-secondary/60 p-3 text-left font-mono text-sm">
        {payload}
      </pre>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-secondary/60">
      <dl className="divide-y divide-border">
        {Object.entries(payload)
          .filter(([, value]) => value !== null && value !== undefined && value !== "")
          .map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{payloadLabels[key] ? t(payloadLabels[key]) : key}</dt>
            <dd className="text-left font-mono text-sm" dir="ltr">
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

type StatusVariant = "warning" | "secondary" | "success" | "destructive"
const statusMap: Record<string, { label: MessageKey; variant: StatusVariant; icon: typeof Clock }> = {
  PENDING: { label: "status.pending", variant: "warning", icon: Clock },
  PAID: { label: "status.paid", variant: "secondary", icon: CheckCircle2 },
  DELIVERED: { label: "status.delivered", variant: "success", icon: CheckCircle2 },
  COMPLETED: { label: "status.completed", variant: "success", icon: CheckCircle2 },
  FAILED: { label: "status.failed", variant: "destructive", icon: XCircle },
  REFUNDED: { label: "status.refunded", variant: "secondary", icon: RotateCcw },
  CANCELLED: { label: "status.cancelled", variant: "secondary", icon: XCircle },
}

export default function OrdersPage() {
  const { user } = useSession()
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: Order[] }>(
    user ? "/api/v1/orders" : null,
    fetcher,
    { refreshInterval: 8000 },
  )
  const orders = data?.data ?? []

  if (!user) {
    return <SignInRequired description={t("orders.signInRequired")} />
  }

  return (
    <div className="space-y-5">
      <PageHeader icon={Package} title={t("orders.title")} />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={t("orders.empty")}
          description={t("orders.emptyDesc")}
          actionLabel={t("orders.emptyAction")}
          actionHref="/flash"
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const s = statusMap[o.status] ?? statusMap.PENDING
            return (
              <li key={o.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      {o.type === "AUCTION" ? (
                        <Gavel className="h-5 w-5 text-primary" />
                      ) : (
                        <Zap className="h-5 w-5 text-primary" />
                      )}
                    </span>
                    <div>
                      <h3 dir="auto" className="font-bold">{o.title}</h3>
                      <span className="text-xs text-muted-foreground">
                        {t("orders.codeLabel")} {o.publicId} • {formatDateTime(o.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={s.variant} className="gap-1 rounded-full">
                      <s.icon className="h-3.5 w-3.5" />
                      {t(s.label)}
                    </Badge>
                    <span className="tabular-nums text-sm font-bold">
                      {formatToman(o.amount)} {t("common.toman")}
                    </span>
                  </div>
                </div>

                {o.quantity > 1 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t("orders.quantity")}: {formatNumber(o.quantity)}
                  </div>
                )}

                {o.delivery?.payload && (
                  <div className="mt-3 space-y-1.5">
                    <span className="text-xs text-muted-foreground">{t("orders.deliveryInfo")}</span>
                    <DeliveryPayload payload={o.delivery.payload} />
                  </div>
                )}
                {o.delivery?.error && o.status === "REFUNDED" && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t("orders.refundedNote")}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
