"use client"

import { use, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, Gavel, Clock, Users, ShieldAlert, TrendingUp, Zap, Calendar, Trophy } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { RichContent, CollapsibleContent } from "@/components/rich-content"
import { BidPanel } from "@/components/bid-panel"
import { WatchButton } from "@/components/watch-button"
import { SegmentedCountdown } from "@/components/segmented-countdown"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { DeliveryBadge } from "@/components/delivery-badge"
import { formatToman, formatDateTime, formatRelative, formatNumber } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

type Bid = {
  id: string
  amount: number
  alias: string
  name: string
  photoUrl: string | null
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

const statusStyles: Record<string, string> = {
  ACTIVE: "border-success/40 bg-success/15 text-success",
  SCHEDULED: "border-primary/40 bg-primary/15 text-primary",
  ENDED: "border-border bg-secondary text-muted-foreground",
  FINALIZED: "border-border bg-secondary text-muted-foreground",
  CANCELLED: "border-destructive/40 bg-destructive/15 text-destructive",
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
        <div className="grid gap-6 web:lg:grid-cols-[1.6fr_1fr]">
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

  const isLive = a.status === "ACTIVE"
  const countdownTarget = a.status === "SCHEDULED" ? a.startTime : a.endTime
  const showCountdown = a.status === "SCHEDULED" || a.status === "ACTIVE"

  return (
    <div className="space-y-6">
      <Link
        href="/auctions"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowRight className="h-4 w-4" />
        {t("adetail.back")}
      </Link>

      {/* Title bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 dir="auto" className="text-balance text-2xl font-extrabold leading-tight sm:text-3xl">
            {a.title}
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
              statusStyles[a.status] ?? "border-border bg-secondary text-muted-foreground"
            }`}
          >
            {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
            {statusLabels[a.status] ? t(statusLabels[a.status]) : a.status}
          </span>
        </div>
        {showCountdown && <WatchButton auctionId={a.id} className="shrink-0" />}
      </div>

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
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <DeliveryBadge type={a.deliveryType} />
              {a.category && (
                <Badge variant="secondary" className="border border-border/60 bg-background/80 backdrop-blur">
                  {a.category}
                </Badge>
              )}
            </div>
          </div>

          {/* Overview / description */}
          {a.description && (
            <section className="card-premium space-y-2 rounded-2xl border border-border p-5">
              <h2 className="text-sm font-bold text-muted-foreground">{t("adetail.overview")}</h2>
              <CollapsibleContent>
                <RichContent content={a.description} className="text-foreground/90" />
              </CollapsibleContent>
            </section>
          )}

          {/* Bid history */}
          <section className="card-premium overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Gavel className="h-4 w-4 text-primary" />
                {t("adetail.bidHistory")}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {t("adetail.bids", { n: formatNumber(a.bidCount) })}
              </span>
            </div>
            {a.bids.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <Gavel className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("adetail.noBids")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {a.bids.map((b, i) => (
                  <li
                    key={b.id}
                    className={`flex items-center justify-between px-4 py-3 ${i === 0 ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9 border border-border">
                          {b.photoUrl && (
                            <AvatarImage src={b.photoUrl} alt={b.name} referrerPolicy="no-referrer" />
                          )}
                          <AvatarFallback className="bg-secondary text-xs font-bold text-muted-foreground">
                            {b.name.trim().charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2 ring-card ${
                            i === 0
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {i === 0 ? <Trophy className="h-2.5 w-2.5" /> : formatNumber(i + 1)}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span dir="auto" className="text-sm font-medium">
                          {b.name}
                        </span>
                        <span dir="auto" className="text-xs text-muted-foreground">
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
          </section>
        </div>

        {/* Right: price stats + countdown + bid panel */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Price highlight */}
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

            {/* Stat strip (Fragment style) */}
            <dl className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-xl border border-border rtl:divide-x-reverse">
              <Stat
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label={t("adetail.minIncrement")}
                value={`${formatToman(a.minimumIncrement)}`}
              />
              <Stat
                icon={<Users className="h-3.5 w-3.5" />}
                label={t("adetail.winnersCount")}
                value={formatNumber(a.quantity)}
              />
              {a.buyNowPrice != null && (
                <Stat
                  icon={<Zap className="h-3.5 w-3.5" />}
                  label={t("adetail.buyNowStat")}
                  value={`${formatToman(a.buyNowPrice)}`}
                />
              )}
              <Stat
                icon={<Calendar className="h-3.5 w-3.5" />}
                label={t("adetail.endTime")}
                value={formatDateTime(a.endTime)}
                small
              />
            </dl>

            {a.hasReserve && (
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  a.reserveMet ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                }`}
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                {a.reserveMet ? t("adetail.reserveMet") : t("adetail.reserveNotMet")}
              </div>
            )}
          </div>

          {/* Countdown */}
          {showCountdown && (
            <div className="card-premium space-y-3 rounded-2xl border border-border p-5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                {a.status === "SCHEDULED" ? t("adetail.startsIn") : t("adetail.endsIn")}
              </span>
              <SegmentedCountdown target={countdownTarget} onComplete={() => mutate()} />
            </div>
          )}

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

function Stat({
  icon,
  label,
  value,
  small,
}: {
  icon: ReactNode
  label: string
  value: string
  small?: boolean
}) {
  return (
    <div className="bg-secondary/40 px-3 py-2.5">
      <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className={`mt-1 font-bold tabular-nums ${small ? "text-xs font-medium" : "text-sm"}`}>{value}</dd>
    </div>
  )
}
