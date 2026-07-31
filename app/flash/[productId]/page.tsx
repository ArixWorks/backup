"use client"

import { use, useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Package, PackageX, Tag, ExternalLink } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { EmptyState } from "@/components/empty-state"
import { FlashBuyButton } from "@/components/flash-buy-button"
import { PlanSelector } from "@/components/plan-selector"
import { ProductWatchButton } from "@/components/product-watch-button"
import { RichContent, CollapsibleContent } from "@/components/rich-content"
import { DeliveryBadge } from "@/components/delivery-badge"
import { ReviewsSection } from "@/components/reviews-section"
import { ProductQuestions } from "@/components/product-questions"
import { StarRating } from "@/components/star-rating"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ProductDetailShell } from "@/components/product-detail/product-detail-shell"
import { useI18n } from "@/components/i18n-provider"
import { useReactiveGoldBorder } from "@/hooks/use-reactive-gold-border"
import type { FlashSale } from "@/components/flash-card"
import { getProductDiscount } from "@/lib/core/product-pricing"

type FlashDetail = FlashSale & {
  images: string[]
  tags: string[]
  highlights: string[]
  bulkUnitPrice: number | null
  ratingAvg: number | null
  ratingCount: number
}

export default function FlashDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params)
  const { t, priceValue, currency, num, dir, locale } = useI18n()
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const borderRef = useReactiveGoldBorder<HTMLDivElement>()
  const { data, isLoading, error, mutate } = useSWR<{ data: FlashDetail }>(
    `/api/v1/flash-sales/${productId}?locale=${locale}`,
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
        toast.success(t("detail.shareCopied"))
      }
    } catch {
      /* user cancelled share */
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pt-4" role="status" aria-busy="true">
        <Skeleton className="aspect-[4/5] w-full rounded-2xl sm:aspect-[16/10]" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4 rounded-lg" />
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  if (error || !p) {
    return (
      <div className="space-y-4 pt-4">
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
  const shownCompareAt = selectedVariant ? selectedVariant.compareAtPrice : (p.compareAtPrice ?? null)
  const {
    hasDiscount,
    percent: discountPercent,
    price: normalizedPrice,
    compareAtPrice: normalizedCompareAt,
  } = getProductDiscount(shownPrice, shownCompareAt)
  const soldOut = shownStock <= 0
  const hasBulk = !!p.bulkMinQty && !!p.bulkDiscountPercent

  // --- Domain panel (pricing + plans + stock + inline buy). Shown in the end
  // column on desktop and inline on mobile via the shell. -----------------
  const primaryPanel = (
    <div
      ref={borderRef}
      className="gold-border-spin space-y-4 rounded-2xl p-5 shadow-lg shadow-primary/5"
    >
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
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-3xl font-extrabold tabular-nums text-primary">
            {priceValue(shownPrice)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-base text-muted-foreground line-through tabular-nums">
                {priceValue(normalizedCompareAt!)}
              </span>
              <span className="inline-flex items-center gap-1 self-center rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">
                <Tag className="h-3 w-3" />
                {discountPercent}% {t("flash.off")}
              </span>
            </>
          )}
        </div>
        {hasDiscount && (
          <p className="mt-1 text-xs font-medium text-success">
            {t("detail.youSave")} {priceValue(normalizedCompareAt! - normalizedPrice)} {currency}
          </p>
        )}
        {hasBulk && p.bulkUnitPrice != null && !hasPlans && (
          <p className="mt-1 text-xs text-success">
            {p.bulkMinQty}+ : {t("detail.eachFrom")} {priceValue(p.bulkUnitPrice)} {currency}
          </p>
        )}
      </div>

      {/* Sale plan selector — collapsible plan picker + comparison. */}
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

      {soldOut && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">{t("detail.restockNotice")}</p>
          <ProductWatchButton productId={productId} />
        </div>
      )}
    </div>
  )

  // --- Long-form sections behind tabs. -----------------------------------
  const infoTab = (
    <div className="space-y-6">
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

      {!p.description && p.tags.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("detail.description")}</p>
      )}
    </div>
  )

  return (
    <ProductDetailShell
      title={p.title}
      hero={{
        image: p.images[0] ?? p.coverImage ?? null,
        backHref: "/flash",
        onShare: share,
        overlay: (
          <>
            <DeliveryBadge type={shownDelivery} />
            {p.category && (
              <Badge variant="secondary" className="border border-border/60 bg-background/80 backdrop-blur">
                {p.category}
              </Badge>
            )}
          </>
        ),
      }}
      titleMeta={
        p.ratingCount > 0 ? (
          <div className="flex items-center gap-2">
            <StarRating value={p.ratingAvg ?? 0} size={15} />
            <span className="text-sm font-medium tabular-nums">{num(p.ratingAvg ?? 0)}</span>
            <span className="text-xs text-muted-foreground">
              ({num(p.ratingCount)} {t("reviews.ratingsCount")})
            </span>
          </div>
        ) : null
      }
      primaryPanel={primaryPanel}
      highlights={p.highlights ?? []}
      similarSeedProductId={productId}
      tabs={[
        { id: "info", label: t("detail.tabInfo"), content: infoTab },
        { id: "reviews", label: t("detail.tabReviews"), content: <ReviewsSection productId={productId} /> },
        { id: "questions", label: t("detail.tabQuestions"), content: <ProductQuestions productId={productId} /> },
      ]}
      stickyInfo={
        <div className="flex flex-col">
          <span className="text-[11px] text-muted-foreground">
            {selectedVariant && variants.length > 1 ? `${t("plan.from")} · ` : ""}
            {soldOut ? t("flash.soldOut") : t("buy.total")}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold tabular-nums text-primary">{priceValue(shownPrice)}</span>
            <span className="text-[11px] text-muted-foreground">{currency}</span>
          </div>
        </div>
      }
      stickyAction={
        <div dir={dir}>
          <FlashBuyButton
            sale={p}
            variant={selectedVariant}
            disabled={hasPlans && !selectedVariant}
            onPurchased={() => mutate()}
            fullWidth
          />
        </div>
      }
    />
  )
}
