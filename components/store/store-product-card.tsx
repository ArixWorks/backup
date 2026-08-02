"use client"

import Image from "next/image"
import Link from "next/link"
import { Bolt, Clock, Layers, ShoppingBag, Star } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { getProductDiscount } from "@/lib/core/product-pricing"
import { cn } from "@/lib/utils"
import type { FlashSale } from "@/components/flash-card"

/** Small two-tone delivery chip: instant = green, manual = amber. */
function DeliveryChip({ type, className }: { type: string; className?: string }) {
  const { t } = useI18n()
  const auto = type === "AUTOMATIC" || type === "AUTO_POOL"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-semibold leading-none",
        auto ? "bg-success/12 text-success" : "bg-warning/15 text-warning",
        className,
      )}
    >
      {auto ? <Bolt className="size-3" /> : <Clock className="size-3" />}
      {auto ? t("flash.autoDelivery") : t("flash.manualDelivery")}
    </span>
  )
}

/** Discount badge pinned to a media corner. */
function DiscountBadge({ percent }: { percent: number }) {
  return (
    <span className="absolute right-2 top-2 z-10 rounded-lg bg-destructive px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-destructive-foreground shadow-sm">
      {percent}%
    </span>
  )
}

/**
 * Storefront product card. The whole card is a single link to the product page
 * (no buy button); clicking anywhere opens the detail page. Two layouts:
 *  - grid: media on top, meta below (2-up rail).
 *  - list: media on the side, meta beside it (single column rows).
 */
export function StoreProductCard({ sale, layout }: { sale: FlashSale; layout: "grid" | "list" }) {
  const { t, priceValue, currency, num } = useI18n()
  // A closed sale (available === false) is surfaced exactly like sold-out stock.
  const unavailable = sale.available === false
  const soldOut = unavailable || sale.stock <= 0
  const overlayLabel = unavailable ? t("store.unavailable") : t("flash.soldOut")
  const planCount = sale.planCount ?? 0
  const { hasDiscount, percent, compareAtPrice } = getProductDiscount(sale.price, sale.compareAtPrice)
  const href = `/flash/${sale.slug || sale.id}`

  const rating =
    sale.hasScore && (sale.score ?? 0) > 0 ? (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
        <span className="tabular-nums">{num(sale.score ?? 0)}</span>
      </span>
    ) : null

  const soldLine =
    !!sale.soldDisplay && sale.soldDisplay > 0 ? (
      <span className="tabular-nums text-muted-foreground/70">
        {num(sale.soldDisplay)} {t("detail.sales")}
      </span>
    ) : null

  const priceBlock = (
    <div className="flex flex-col gap-0.5">
      {hasDiscount && (
        <span className="text-[11px] text-muted-foreground line-through tabular-nums">
          {priceValue(compareAtPrice!)} {currency}
        </span>
      )}
      <span className="text-[15px] font-extrabold tabular-nums text-primary">
        {priceValue(sale.price)} <span className="text-[11px] font-medium text-muted-foreground">{currency}</span>
      </span>
    </div>
  )

  const planLine =
    planCount > 1 ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
        <Layers className="size-3" aria-hidden="true" />
        {num(planCount)} {t("store.plans")}
      </span>
    ) : null

  if (layout === "list") {
    return (
      <Link
        href={href}
        aria-label={sale.title}
        className="card-premium group flex items-stretch gap-3 overflow-hidden rounded-2xl border border-border p-2.5 transition-all duration-300 hover:border-primary/45 hover:elevate-lg"
      >
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted">
          {sale.coverImage ? (
            <Image
              src={sale.coverImage || "/placeholder.svg"}
              alt={sale.title}
              fill
              sizes="96px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <ShoppingBag className="size-7" aria-hidden="true" />
            </span>
          )}
          {hasDiscount && <DiscountBadge percent={percent} />}
          {soldOut && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-[11px] font-bold">
              {overlayLabel}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 py-0.5">
          <div className="flex flex-col gap-1">
            <span dir="auto" className="line-clamp-1 text-[13px] font-bold leading-tight">
              {sale.title}
            </span>
            <div className="flex items-center gap-2 text-[10.5px]">
              {rating}
              {soldLine}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DeliveryChip type={sale.deliveryType} />
            {planLine}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-center ps-1 text-end">{priceBlock}</div>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      aria-label={sale.title}
      className="card-premium group flex flex-col overflow-hidden rounded-2xl border border-border p-2.5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:elevate-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        {sale.coverImage ? (
          <Image
            src={sale.coverImage || "/placeholder.svg"}
            alt={sale.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="size-10" aria-hidden="true" />
          </span>
        )}
        {hasDiscount && <DiscountBadge percent={percent} />}
        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-bold">
            {overlayLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-1 pb-1 pt-2.5">
        <span dir="auto" className="line-clamp-1 text-[13px] font-bold leading-tight">
          {sale.title}
        </span>
        <div className="flex items-center gap-2 text-[10.5px]">
          {rating}
          {soldLine}
        </div>
        <DeliveryChip type={sale.deliveryType} className="self-start" />
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          {priceBlock}
          {planLine}
        </div>
      </div>
    </Link>
  )
}
