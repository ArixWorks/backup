"use client"

import Link from "next/link"
import { Zap, Gavel, Globe, Server, Ticket, ChevronLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StatusChip } from "./status-chip"
import { formatToman, formatDateTime } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"
import { orderCopy } from "@/lib/i18n/order-copy"
import type { OrderListItem, OrderCategory } from "@/lib/orders/shared"

const CATEGORY_ICON: Record<OrderCategory, typeof Zap> = {
  SHOP: Zap,
  AUCTION: Gavel,
  DOMAIN: Globe,
  VPS: Server,
}

const IN_FLIGHT = new Set([
  "PENDING",
  "PAID",
  "AWAITING_CUSTOMER_INPUT",
  "PROCESSING",
  "AWAITING_EXTENSION_APPROVAL",
  // domain lifecycle
  "PENDING_PURCHASE",
  "AWAITING_NAMESERVERS",
  "AWAITING_NAMESERVER_SETUP",
])

/**
 * A single order summary card. Colourful status chip, a live progress bar for
 * in-flight orders, price, code/date, an optional "lottery" tag, and a clear
 * call-to-action when the buyer must act (submit info / approve extension).
 * The whole card links to the dedicated detail/roadmap page.
 */
export function OrderCard({ order }: { order: OrderListItem }) {
  const { t, locale } = useI18n()
  const c = orderCopy(locale)
  const Icon = order.isGiveawayPrize ? Ticket : CATEGORY_ICON[order.category]
  const needsAction = order.status === "AWAITING_CUSTOMER_INPUT" || order.status === "AWAITING_EXTENSION_APPROVAL"
  const inFlight = IN_FLIGHT.has(order.status)

  return (
    <li>
      <Link
        href={order.href}
        className="group block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Icon className="h-5 w-5 text-primary" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 dir="auto" className="font-bold text-pretty">
                  {order.title}
                </h3>
                {order.isGiveawayPrize && (
                  <Badge variant="warning" className="gap-1 rounded-full text-[10px]">
                    <Ticket className="h-3 w-3" />
                    {c.giveawayTag}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {c.codeLabel} {order.publicId} • {formatDateTime(order.createdAt)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusChip status={order.status} />
            <span className="tabular-nums text-sm font-bold">
              {order.amount > 0 ? `${formatToman(order.amount)} ${t("common.toman")}` : c.free}
            </span>
          </div>
        </div>

        {/* progress bar for in-flight orders */}
        {inFlight && order.progress > 0 && (
          <div className="mt-3">
            <Progress value={order.progress} className="h-1.5" />
          </div>
        )}

        {/* summary + CTA row */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={needsAction ? "text-sm font-medium text-primary" : "text-sm text-muted-foreground"}>
            {c.summaries[order.status] ?? c.statuses[order.status] ?? order.status}
          </span>
          <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            {c.viewDetails}
            <ChevronLeft className="h-3.5 w-3.5 ltr:rotate-180" />
          </span>
        </div>
      </Link>
    </li>
  )
}
