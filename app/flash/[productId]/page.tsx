"use client"

import { use, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import { ArrowRight, Package, PackageX, Tag, ExternalLink, Share2 } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { EmptyState } from "@/components/empty-state"
import { FlashBuyButton } from "@/components/flash-buy-button"
import { ProductWatchButton } from "@/components/product-watch-button"
import { ProductGallery } from "@/components/product-gallery"
import { DeliveryBadge } from "@/components/delivery-badge"
import { ReviewsSection } from "@/components/reviews-section"
import { StarRating } from "@/components/star-rating"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { Reveal } from "@/components/motion"
import type { FlashSale } from "@/components/flash-card"

type FlashDetail = FlashSale & {
  images: string[]
  tags: string[]
  bulkUnitPrice: number | null
  ratingAvg: number | null
  ratingCount: number
}

export default function FlashDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params)
  const { t, priceValue, currency, num, dir } = useI18n()
  const [copied, setCopied] = useState(false)
  const { data, isLoading, error, mutate } = useSWR<{ data: FlashDetail }>(
    `/api/v1/flash-sales/${productId}`,
    fetcher,
    { refreshInterval: 15000 },
  )
  const p = data?.data

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : ""
    try {
      if (navigator.share) {
        await navigator.share({ title: p?.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        toast.success(t("detail.shareCopied"))
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* user cancelled share */
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  if (error || !p) {
    return (
      <div className="space-y-4">
        <Link
          href="/flash"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowRight className="h-4 w-4" />
          {t("detail.back")}
        </Link>
        <EmptyState
          icon={PackageX}
          title={t("detail.notFound")}
          actionLabel={t("detail.back")}
          actionHref="/flash"
        />
      </div>
    )
  }

  const soldOut = p.stock <= 0
  const hasBulk = !!p.bulkMinQty && !!p.bulkDiscountPercent

  return (
    <div className="space-y-6">
      <Link
        href="/flash"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowRight className="h-4 w-4" />
        {t("detail.back")}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: gallery + description */}
        <div className="space-y-6">
          <ProductGallery images={p.images} alt={p.title} />

          {p.description && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold">{t("detail.description")}</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                {p.description}
              </p>
            </section>
          )}

          {p.tags.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold">{t("detail.tags")}</h2>
              <div className="flex flex-wrap gap-1.5">
                {p.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {p.links && p.links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {p.links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Right: purchase panel */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="gold-border surface-glow space-y-4 rounded-2xl p-5 shadow-lg shadow-primary/5">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl font-extrabold leading-tight text-balance">{p.title}</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={share}
                aria-label={t("detail.share")}
                className="shrink-0"
              >
                <Share2 className={copied ? "h-4 w-4 text-success" : "h-4 w-4"} />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DeliveryBadge type={p.deliveryType} />
              {p.category && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {p.category}
                </span>
              )}
            </div>

            {p.ratingCount > 0 && (
              <div className="flex items-center gap-2">
                <StarRating value={p.ratingAvg ?? 0} size={16} />
                <span className="text-sm font-medium tabular-nums">{num(p.ratingAvg ?? 0)}</span>
                <span className="text-xs text-muted-foreground">
                  ({num(p.ratingCount)} {t("reviews.ratingsCount")})
                </span>
              </div>
            )}

            <div>
              <span className="text-xs text-muted-foreground">{currency}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tabular-nums text-primary">
                  {priceValue(p.price)}
                </span>
              </div>
              {hasBulk && p.bulkUnitPrice != null && (
                <p className="mt-1 text-xs text-success">
                  {p.bulkMinQty}+ : {t("detail.eachFrom")} {priceValue(p.bulkUnitPrice)} {currency}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Package className="h-4 w-4" />
                {t("flash.stock")}
              </span>
              <span className="font-bold tabular-nums">
                {soldOut ? t("flash.soldOut") : num(p.stock)}
              </span>
            </div>

            <div dir={dir}>
              <FlashBuyButton sale={p} onPurchased={() => mutate()} fullWidth />
            </div>

            {soldOut && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">{t("detail.restockNotice")}</p>
                <ProductWatchButton productId={productId} />
              </div>
            )}
          </div>
        </div>
      </div>

      <Reveal>
        <ReviewsSection productId={productId} />
      </Reveal>
    </div>
  )
}
