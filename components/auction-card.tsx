"use client"

import Link from "next/link"
import Image from "next/image"
import { Gavel, Users } from "lucide-react"
import { Countdown } from "@/components/countdown"
import { DeliveryBadge } from "@/components/delivery-badge"
import { formatNumber } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"

export type AuctionSummary = {
  id: string
  title: string
  category: string | null
  coverImage: string | null
  deliveryType: string
  currentPrice: number
  minNextBid: number
  buyNowPrice: number | null
  status: string
  endTime: string
  startTime: string
  bidCount: number
  quantity: number
}

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  const { t, priceValue, currency } = useI18n()
  const live = auction.status === "ACTIVE"
  const scheduled = auction.status === "SCHEDULED"

  return (
    <Link
      href={`/auctions/${auction.id}`}
      className="active:scale-press card-premium group flex flex-col overflow-hidden rounded-2xl border border-border transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:elevate-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {auction.coverImage && (
          <Image
            src={auction.coverImage || "/placeholder.svg"}
            alt={auction.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        )}
        {/* Legibility scrim so badges & gradients read cleanly over any image. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {live && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-medium text-destructive-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive-foreground" />
              {t("auctions.live")}
            </span>
          )}
          {scheduled && (
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
          <h3 dir="auto" className="line-clamp-1 font-bold leading-6">{auction.title}</h3>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {formatNumber(auction.bidCount)}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <span className="text-xs text-muted-foreground">
              {t("auctions.currentBid")}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold tabular-nums text-primary">
                {priceValue(auction.currentPrice)}
              </span>
              <span className="text-xs text-muted-foreground">{currency}</span>
            </div>
          </div>
          <div className="text-left">
            <span className="text-xs text-muted-foreground">
              {scheduled ? t("auctions.startsAt") : t("auctions.ended")}
            </span>
            <div className="text-sm font-medium">
              <Countdown target={scheduled ? auction.startTime : auction.endTime} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          <Gavel className="h-3.5 w-3.5 text-primary" />
          {t("auctions.currentBid")}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {priceValue(auction.minNextBid)} {currency}
          </span>
        </div>
      </div>
    </Link>
  )
}
