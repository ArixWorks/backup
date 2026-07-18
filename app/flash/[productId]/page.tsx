"use client"

import { use, useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import { ArrowRight, Package, PackageX, Tag, ExternalLink, Share2 } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { EmptyState } from "@/components/empty-state"
import { FlashBuyButton } from "@/components/flash-buy-button"
import { PlanSelector } from "@/components/plan-selector"
import { ProductWatchButton } from "@/components/product-watch-button"
import { ProductGallery } from "@/components/product-gallery"
import { RichContent, CollapsibleContent } from "@/components/rich-content"
import { DeliveryBadge } from "@/components/delivery-badge"
import { ReviewsSection } from "@/components/reviews-section"
import { StarRating } from "@/components/star-rating"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
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
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const { data, isLoading, error, mutate } = useSWR<{ data: FlashDetail }>(
    `/api/v1/flash-sales/${productId}`,
    fetcher,
    { refreshInterval: 15000 },
  )
  const p = data?.data

  // Multi-plan products let the user choose which plan to buy. The default
  // (first, in-stock when possible) is auto-selected so there is always a valid
  // target. Single-plan products render exactly like before (no selector).
  const variants = useMemo(() => p?.variants ?? [], [p?.variants])
  const hasPlans = variants.length > 0
  const effectiveSelectedId = useMemo(() => {
    if (!hasPlans) return null
    if (selectedPlanId && variants.some((v) => v.id === selectedPlanId)) return selectedPlanId
    return (variants.find((v) => v.stock > 0) ?? variants[0]).id
  }, [hasPlans, selectedPlanId, variants])
  const selectedVariant = hasPlans
    ? (variants.find((v) => v.id === effectiveSelectedId) ?? null)
    : null

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
      <div className="space-y-6" role="status" aria-busy="true">
        <Skeleton className="h-5 w-20 rounded-full" />
        <div className="grid gap-6 web:lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <Skeleton className="aspect-square w-full rounded-2xl sm:aspect-[4/3]" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 rounded-full" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
        <span className="sr-only">Loading…</span>
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

  // Displayed price/stock follow the selected plan when the product has plans.
  const shownPrice = selectedVariant ? selectedVariant.price : p.price
  const shownStock = selectedVariant ? selectedVariant.stock : p.stock
  const shownDelivery = selectedVariant ? selectedVariant.deliveryType : p.deliveryType
  const soldOut = shownStock <= 0
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
              <CollapsibleContent>
                <RichContent content={p.description} />
              </CollapsibleContent>
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
        <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="gold-border surface-glow space-y-4 rounded-2xl p-5 shadow-lg shadow-primary/5">
            <div className="flex items-start justify-between gap-2">
              <h1 dir="auto" className="text-xl font-extrabold leading-tight text-balance">{p.title}</h1>
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
              <DeliveryBadge type={shownDelivery} />
              {p.category && <Badge variant="secondary">{p.category}</Badge>}
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
              <span className="text-xs text-muted-foreground">
                {selectedVariant && variants.length > 1 ? t("plan.from") : ""} {currency}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tabular-nums text-primary">
                  {priceValue(shownPrice)}
                </span>
              </div>
              {hasBulk && p.bulkUnitPrice != null && !hasPlans && (
                <p className="mt-1 text-xs text-success">
                  {p.bulkMinQty}+ : {t("detail.eachFrom")} {priceValue(p.bulkUnitPrice)} {currency}
                </p>
              )}
            </div>

            {/* Sale plan selector — only when the product offers multiple plans. */}
            {hasPlans && (
              <PlanSelector
                variants={variants}
                selectedId={effectiveSelectedId}
                onSelect={setSelectedPlanId}
              />
            )}

            <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Package className="h-4 w-4" />
                {t("flash.stock")}
              </span>
              <span className="font-bold tabular-nums">
                {soldOut ? t("flash.soldOut") : num(shownStock)}
              </span>
            </div>

            <div dir={dir}>
              <FlashBuyButton
                sale={p}
                variant={selectedVariant}
                disabled={hasPlans && !selectedVariant}
                onPurchased={() => mutate()}
                fullWidth
              />
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
