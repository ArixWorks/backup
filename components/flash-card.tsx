"use client"

import Image from "next/image"
import Link from "next/link"
import { Package, Tag, ExternalLink } from "lucide-react"
import { DeliveryBadge } from "@/components/delivery-badge"
import { FlashBuyButton } from "@/components/flash-buy-button"
import { useI18n } from "@/components/i18n-provider"

export type ProductLink = { label: string; url: string }

export type FlashSale = {
  id: string
  slug: string
  title: string
  description: string | null
  category: string | null
  coverImage: string | null
  deliveryType: string
  price: number
  stock: number
  purchaseLimit: number | null
  links?: ProductLink[]
  soldDisplay?: number
  bulkMinQty?: number | null
  bulkDiscountPercent?: number | null
}

export function FlashCard({ sale, onPurchased }: { sale: FlashSale; onPurchased?: () => void }) {
  const { t, priceValue, currency, num } = useI18n()
  const soldOut = sale.stock <= 0
  const low = !soldOut && sale.stock <= 5
  const hasBulk = !!sale.bulkMinQty && !!sale.bulkDiscountPercent

  return (
    <div className="card-premium group flex flex-col overflow-hidden rounded-2xl border border-border transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:elevate-lg">
      <Link
        href={`/flash/${sale.id}`}
        className="relative block aspect-[16/10] overflow-hidden bg-muted"
        aria-label={sale.title}
      >
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
        <div className="absolute bottom-3 left-3">
          <DeliveryBadge type={sale.deliveryType} />
        </div>
        {soldOut ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <span className="rounded-full bg-secondary px-4 py-1 text-sm font-bold">
              {t("flash.soldOut")}
            </span>
          </div>
        ) : (
          <span
            className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              low ? "bg-warning text-warning-foreground" : "bg-secondary text-foreground"
            }`}
          >
            <Package className="h-3 w-3" />
            {num(sale.stock)} {t("flash.stock")}
          </span>
        )}
        {hasBulk && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
            <Tag className="h-3 w-3" />
            {sale.bulkDiscountPercent}%
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/flash/${sale.id}`} className="line-clamp-1 font-bold leading-6 hover:text-primary">
            {sale.title}
          </Link>
          {!!sale.soldDisplay && sale.soldDisplay > 0 && (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {t("flash.sold")}: {num(sale.soldDisplay)}
            </span>
          )}
        </div>
        {sale.description && (
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{sale.description}</p>
        )}
        {sale.links && sale.links.length > 0 && (
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
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold tabular-nums text-primary">
                {priceValue(sale.price)}
              </span>
            </div>
            {hasBulk && (
              <span className="text-[11px] text-success">
                {sale.bulkMinQty}+ : {sale.bulkDiscountPercent}%
              </span>
            )}
          </div>
          <FlashBuyButton sale={sale} onPurchased={onPurchased} />
        </div>
      </div>
    </div>
  )
}
