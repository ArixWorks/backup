"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Gavel, Users, Trophy, Clock } from "lucide-react"
import { Countdown } from "@/components/countdown"
import { DeliveryBadge } from "@/components/delivery-badge"
import { formatNumber } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"
import {
  deriveAuctionDisplayState,
  isEndingSoon,
  IMAGE_TREATMENT_CLASS,
} from "@/lib/core/auction/display-state"

export type AuctionSummary = {
  id: string
  title: string
  category: string | null
  coverImage: string | null
  deliveryType: string
  currentPrice: number
  minNextBid: number
  buyNowPrice: number | null
  // Real market value reference anchor (presentational only; may be absent).
  estimatedValue?: number | null
  status: string
  endTime: string
  startTime: string
  bidCount: number
  quantity: number
  // Authoritative settlement result (optional; present once finalized).
  finalPrice?: number | null
  endReason?: string | null
}

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  const { t, priceValue, currency } = useI18n()

  // Single source of truth for presentation (shared with the detail page + bot).
  const ds = deriveAuctionDisplayState({
    status: auction.status,
    endReason: auction.endReason,
    finalPrice: auction.finalPrice,
    bidCount: auction.bidCount,
  })

  // Time-based urgency is client-only to stay hydration-safe.
  const [endingSoon, setEndingSoon] = useState(false)
  useEffect(() => {
    if (!ds.isLive) return
    const tick = () => setEndingSoon(isEndingSoon(ds, auction.endTime))
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [ds, auction.endTime])

  // Headline price: settled final price when sold; live/current price otherwise.
  const headlineLabel = ds.isTerminal
    ? ds.hasWinner
      ? t("auctions.finalPrice")
      : t("auctions.ended")
    : auction.bidCount > 0
      ? t("auctions.currentBid")
      : t("auctions.startingPrice")
  const headlinePrice =
    ds.hasWinner && auction.finalPrice != null ? auction.finalPrice : auction.currentPrice

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className={`active:scale-press card-premium group flex flex-col overflow-hidden rounded-2xl border border-border transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:elevate-lg ${
        endingSoon ? "auction-urgent" : ""
      } ${ds.isTerminal ? "opacity-95" : ""}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {auction.coverImage && (
          <Image
            src={auction.coverImage || "/placeholder.svg"}
            alt={auction.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className={`object-cover transition-all duration-700 ease-out group-hover:scale-110 ${IMAGE_TREATMENT_CLASS[ds.imageTreatment]}`}
          />
        )}
        {/* Legibility scrim so badges & gradients read cleanly over any image. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />

        {/* Diagonal outcome stamp for settled auctions. */}
        {ds.showStamp && ds.stampKey && (
          <span className="auction-stamp" data-tone={ds.tone}>
            {t(ds.stampKey as Parameters<typeof t>[0])}
          </span>
        )}

        {/* Top-right status pill (live / ending-soon / scheduled). */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {ds.isLive && endingSoon && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-medium text-destructive-foreground">
              <Clock className="h-3 w-3" />
              {t("auctions.endingSoon")}
            </span>
          )}
          {ds.isLive && !endingSoon && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-medium text-destructive-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive-foreground" />
              {t("auctions.live")}
            </span>
          )}
          {ds.isScheduled && (
            <span className="rounded-full bg-primary/90 px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
              {t("auctions.scheduled")}
            </span>
          )}
        </div>
        <div className="absolute bottom-3 left-3">
          <DeliveryBadge type={auction.deliveryType} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 dir="auto" className="line-clamp-1 font-bold leading-6">
            {auction.title}
          </h3>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {formatNumber(auction.bidCount)}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <span className="text-xs text-muted-foreground">{headlineLabel}</span>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-lg font-extrabold tabular-nums ${
                  ds.isTerminal && !ds.hasWinner ? "text-muted-foreground" : "text-primary"
                }`}
              >
                {priceValue(headlinePrice)}
              </span>
              <span className="text-xs text-muted-foreground">{currency}</span>
            </div>
            {!ds.isTerminal && auction.estimatedValue != null && (
              <span className="mt-0.5 flex items-baseline gap-1 text-[11px] text-muted-foreground">
                {t("auctions.trueValue")}:
                <span className="tabular-nums line-through">{priceValue(auction.estimatedValue)}</span>
              </span>
            )}
          </div>
          <div className="text-left">
            <span className="text-xs text-muted-foreground">
              {ds.isScheduled ? t("auctions.startsAt") : t("auctions.ended")}
            </span>
            <div className="text-sm font-medium">
              {ds.isTerminal ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  {ds.hasWinner && <Trophy className="h-3.5 w-3.5 text-success" />}
                  {t(ds.statusKey as Parameters<typeof t>[0])}
                </span>
              ) : (
                <Countdown target={ds.isScheduled ? auction.startTime : auction.endTime} />
              )}
            </div>
          </div>
        </div>

        {!ds.isTerminal && (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
            <Gavel className="h-3.5 w-3.5 text-primary" />
            {t("auctions.nextBid")}:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {priceValue(auction.minNextBid)} {currency}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
