"use client"

import Image from "next/image"
import Link from "next/link"
import { Package, Tag, ExternalLink, Star } from "lucide-react"
import { DeliveryBadge } from "@/components/delivery-badge"
import { FlashBuyButton } from "@/components/flash-buy-button"
import { useI18n } from "@/components/i18n-provider"
import { richExcerpt } from "@/lib/rich-content/render"
import { getProductDiscount, type SerializedPrice } from "@/lib/core/product-pricing"

export type ProductLink = { label: string; url: string }

/** A single purchasable sale plan (e.g. "1-month single device"). */
export type PlanVariant = {
  id: string
  name: string
  attributes: Record<string, unknown> | null
  description: string | null
  price: SerializedPrice
  compareAtPrice: SerializedPrice | null
  stock: number
  purchaseLimit: number | null
  deliveryType: string
  soldCount?: number
}

export type FlashSale = {
  id: string
  slug: string
  title: string
  description: string | null
  category: string | null
  coverImage: string | null
  deliveryType: string
  price: number
  compareAtPrice?: number | null
  stock: number
  purchaseLimit: number | null
  links?: ProductLink[]
  soldDisplay?: number
  bulkMinQty?: number | null
  bulkDiscountPercent?: number | null
  variants?: PlanVariant[]
  score?: number
  hasScore?: boolean
  /** Number of active sale plans; the store card shows "N پلن" when > 1. */
  planCount?: number
  /** Admin sale switch; false means the card shows "ناموجود" and buying is blocked. */
  available?: boolean
}

export function FlashCard({
  sale,
  onPurchased,
  compact = false,
}: {
  sale: FlashSale
  onPurchased?: () => void
  /** Denser card for tight rails (e.g. similar-products): no delivery badge,
      smaller title, a rating + sales line, and no description / "was" price. */
  compact?: boolean
}) {
  const { t, priceValue, currency, num } = useI18n()
  const soldOut = sale.stock <= 0
  const low = !soldOut && sale.stock <= 5
  const hasBulk = !!sale.bulkMinQty && !!sale.bulkDiscountPercent
  const { hasDiscount, percent: discountPercent, compareAtPrice } = getProductDiscount(
    sale.price,
    sale.compareAtPrice,
  )

  const cardClass =
    "card-premium group flex flex-col overflow-hidden rounded-2xl border border-border transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:elevate-lg"
  // In compact mode the whole card is one link (no buy button), so the media
  // and title must NOT be nested anchors — render them as plain elements.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CardRoot: any = compact ? Link : "div"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MediaTag: any = compact ? "div" : Link
  const productHref = `/flash/${sale.slug || sale.id}`
  const cardRootProps = compact ? { href: productHref, "aria-label": sale.title } : {}
  const mediaProps = compact ? {} : { href: productHref, "aria-label": sale.title }

  return (
    <CardRoot {...cardRootProps} className={cardClass}>
      <MediaTag {...mediaProps} className="relative block aspect-[16/10] overflow-hidden bg-muted">
        {sale.coverImage && (
          <Image
            src={sale.coverImage || "/placeholder.svg"}
            alt={sale.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
        {!compact && (
          <div className="absolute bottom-3 left-3">
            <DeliveryBadge type={sale.deliveryType} />
          </div>
        )}
        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <span className="rounded-full bg-secondary px-4 py-1 text-sm font-bold">
              {t("flash.soldOut")}
            </span>
          </div>
        ) : (
          !compact && (
            <span
              className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                low ? "bg-warning text-warning-foreground" : "bg-secondary text-foreground"
              }`}
            >
              <Package className="h-3 w-3" />
              {num(sale.stock)} {t("flash.stock")}
            </span>
          )
        )}
        {(hasDiscount || hasBulk) && (
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {hasDiscount && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground shadow-sm">
                <Tag className="h-3 w-3" />
                {discountPercent}% {t("flash.off")}
              </span>
            )}
            {hasBulk && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                <Tag className="h-3 w-3" />
                {sale.bulkDiscountPercent}%
              </span>
            )}
          </div>
        )}
      </MediaTag>

      <div className={compact ? "flex flex-1 flex-col gap-2 p-3" : "flex flex-1 flex-col gap-3 p-4"}>
        {compact ? (
          <div className="flex flex-col gap-1.5">
            <span dir="auto" className="line-clamp-1 text-[13px] font-bold leading-tight">
              {sale.title}
            </span>
            {/* Rating (blended product score) + total sales, per the compact spec. */}
            <div className="flex items-center gap-2 text-[10.5px]">
              {sale.hasScore && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
                  <span className="tabular-nums">{num(sale.score ?? 0)}</span>
                </span>
              )}
              {!!sale.soldDisplay && sale.soldDisplay > 0 && (
                <span className="tabular-nums text-muted-foreground/70">
                  {num(sale.soldDisplay)} {t("detail.sales")}
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <Link href={productHref} dir="auto" className="line-clamp-1 font-bold leading-6 hover:text-primary">
                {sale.title}
              </Link>
              {!!sale.soldDisplay && sale.soldDisplay > 0 && (
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {t("flash.sold")}: {num(sale.soldDisplay)}
                </span>
              )}
            </div>
            {sale.description && richExcerpt(sale.description) && (
              <p dir="auto" className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                {richExcerpt(sale.description)}
              </p>
            )}
          </>
        )}
        {!compact && sale.links && sale.links.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sale.links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary/10"
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </a>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <span className="text-xs text-muted-foreground">{currency}</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold tabular-nums text-primary">
                {priceValue(sale.price)}
              </span>
              {!compact && hasDiscount && (
                <span className="text-xs text-muted-foreground line-through tabular-nums">
                  {priceValue(compareAtPrice!)}
                </span>
              )}
            </div>
            {hasBulk && (
              <span className="text-[11px] text-success">
                {sale.bulkMinQty}+ : {sale.bulkDiscountPercent}%
              </span>
            )}
          </div>
          {!compact && <FlashBuyButton sale={sale} onPurchased={onPurchased} />}
        </div>
      </div>
    </CardRoot>
  )
}
