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
import { Skeleton } from "@/components/ui/skeleton"
import { formatToman, formatDateTime, formatRelative, formatNumber } from "@/lib/format"

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

const statusLabels: Record<string, string> = {
  SCHEDULED: "زمان‌بندی‌شده",
  ACTIVE: "در حال برگزاری",
  ENDED: "پایان‌یافته",
  FINALIZED: "تسویه‌شده",
  CANCELLED: "لغوشده",
}

export default function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, mutate } = useSWR<{ data: AuctionDetail }>(
    `/api/v1/auctions/${id}`,
    fetcher,
    { refreshInterval: 5000 },
  )
  const a = data?.data

  if (isLoading || !a) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
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
        بازگشت به مزایده‌ها
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Left: media + info + history */}
        <div className="space-y-6">
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border bg-muted">
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
            <div className="absolute right-3 top-3 flex gap-2">
              <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur">
                {statusLabels[a.status] ?? a.status}
              </span>
            </div>
            <div className="absolute bottom-3 left-3">
              <DeliveryBadge type={a.deliveryType} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {a.category && (
                <span className="rounded-full bg-secondary px-2 py-0.5">{a.category}</span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {formatNumber(a.bidCount)} پیشنهاد
              </span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight">{a.title}</h1>
            {a.description && (
              <p className="leading-relaxed text-muted-foreground">{a.description}</p>
            )}
          </div>

          {/* Bid history */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-bold">
              <Gavel className="h-4 w-4 text-primary" />
              تاریخچه پیشنهادها
            </div>
            {a.bids.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                هنوز پیشنهادی ثبت نشده است. اولین پیشنهاد را شما ثبت کنید.
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
                          {b.isAuto && " • خودکار"}
                        </span>
                      </div>
                    </div>
                    <span className="tabular-nums font-bold">
                      {formatToman(b.amount)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">تومان</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: price + countdown + bid panel */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div>
              <span className="text-xs text-muted-foreground">
                {a.bidCount > 0 ? "بالاترین پیشنهاد فعلی" : "قیمت پایه"}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tabular-nums text-primary">
                  {formatToman(a.currentPrice)}
                </span>
                <span className="text-sm text-muted-foreground">تومان</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {a.status === "SCHEDULED" ? "شروع تا" : "پایان تا"}
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
                {a.reserveMet ? "قیمت رزرو فروشنده تأمین شده است" : "قیمت رزرو هنوز تأمین نشده است"}
              </div>
            )}

            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Detail label="حداقل افزایش" value={`${formatToman(a.minimumIncrement)} ت`} />
              <Detail label="تعداد برنده" value={formatNumber(a.quantity)} />
              <Detail label="زمان پایان" value={formatDateTime(a.endTime)} full />
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
