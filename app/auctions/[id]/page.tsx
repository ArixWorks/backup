"use client"

import { use } from "react"
import Image from "next/image"
import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, Gavel, Clock, Users, ShieldAlert } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { BidPanel } from "@/components/bid-panel"
import { WatchButton } from "@/components/watch-button"
import { Countdown } from "@/components/countdown"
import { DeliveryBadge } from "@/components/delivery-badge"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatToman, formatDateTime, formatRelative, formatNumber } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

type Bid = {
  id: string
  amount: number
  alias: string
  isAuto: boolean
  createdAt: string
}

type AuctionDetail = {
  id: string
  title: string
  description: string | null
  category: string | null
  coverImage: string | null
  deliveryType: string
  startPrice: number
  currentPrice: number
  minNextBid: number
  minimumIncrement: number
  buyNowPrice: number | null
  hasReserve: boolean
  reserveMet: boolean
  startTime: string
  endTime: string
  status: string
  quantity: number
  bidCount: number
  bids: Bid[]
}

const statusLabels: Record<string, MessageKey> = {
  SCHEDULED: "auctions.scheduled",
  ACTIVE: "auctions.live",
  ENDED: "auctions.ended",
  FINALIZED: "auctions.finalized",
  CANCELLED: "auctions.cancelled",
}

export default function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useI18n()
  const { id } = use(params)
  const { data, isLoading, mutate } = useSWR<{ data: AuctionDetail }>(
    `/api/v1/auctions/${id}`,
    fetcher,
    { refreshInterval: 5000 },
  )
  const a = data?.data

  if (isLoading || !a) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <Skeleton className="h-5 w-24 rounded-full" />
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-32 rounded-full" />
              <Skeleton className="h-7 w-3/4 rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/auctions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowRight className="h-4 w-4" />
        {t("adetail.back")}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Left: media + info + history */}
        <div className="space-y-6">
          <div className="card-premium relative aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-muted">
            {a.coverImage && (
              <Image
                src={a.coverImage || "/placeholder.svg"}
                alt={a.title}
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
                priority
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/70 via-transparent to-transparent" />
            <div className="absolute right-3 top-3 flex gap-2">
              <Badge
                variant="secondary"
                className="border border-border/60 bg-background/80 backdrop-blur"
              >
                {statusLabels[a.status] ? t(statusLabels[a.status]) : a.status}
              </Badge>
            </div>
            <div className="absolute bottom-3 left-3">
              <DeliveryBadge type={a.deliveryType} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {a.category && (
                <Badge variant="secondary">{a.category}</Badge>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {t("adetail.bids", { n: formatNumber(a.bidCount) })}
              </span>
            </div>
            <h1 dir="auto" className="text-balance text-2xl font-extrabold leading-tight">{a.title}</h1>
            {a.description && (
              <p dir="auto" className="text-pretty leading-relaxed text-muted-foreground">{a.description}</p>
            )}
          </div>

          {/* Bid history */}
          <div className="card-premium overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold">
              <Gavel className="h-4 w-4 text-primary" />
              {t("adetail.bidHistory")}
            </div>
            {a.bids.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {t("adetail.noBids")}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {a.bids.map((b, i) => (
                  <li key={b.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary"
                        }`}
                      >
                        {formatNumber(i + 1)}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{b.alias}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelative(b.createdAt)}
                          {b.isAuto && ` • ${t("adetail.auto")}`}
                        </span>
                      </div>
                    </div>
                    <span className="tabular-nums font-bold">
                      {formatToman(b.amount)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">{t("common.toman")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: price + countdown + bid panel */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card-premium space-y-4 rounded-2xl border border-border p-5">
            <div>
              <span className="text-xs text-muted-foreground">
                {a.bidCount > 0 ? t("adetail.topBidNow") : t("adetail.basePrice")}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tabular-nums text-primary">
                  {formatToman(a.currentPrice)}
                </span>
                <span className="text-sm text-muted-foreground">{t("common.toman")}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {a.status === "SCHEDULED" ? t("adetail.startsIn") : t("adetail.endsIn")}
              </span>
              <Countdown
                target={a.status === "SCHEDULED" ? a.startTime : a.endTime}
                onComplete={() => mutate()}
                className="text-base font-bold"
              />
            </div>

            {a.hasReserve && (
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  a.reserveMet ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                {a.reserveMet ? t("adetail.reserveMet") : t("adetail.reserveNotMet")}
              </div>
            )}

            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Detail label={t("adetail.minIncrement")} value={`${formatToman(a.minimumIncrement)} ${t("common.toman")}`} />
              <Detail label={t("adetail.winnersCount")} value={formatNumber(a.quantity)} />
              <Detail label={t("adetail.endTime")} value={formatDateTime(a.endTime)} full />
            </dl>

            {(a.status === "SCHEDULED" || a.status === "ACTIVE") && (
              <WatchButton auctionId={a.id} className="w-full" />
            )}
          </div>

          <BidPanel
            auctionId={a.id}
            minNextBid={a.minNextBid}
            buyNowPrice={a.buyNowPrice}
            minimumIncrement={a.minimumIncrement}
            status={a.status}
            onChanged={() => mutate()}
          />
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div
      className={`rounded-lg bg-secondary/60 px-3 py-2 ${full ? "col-span-2" : ""}`}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  )
}
