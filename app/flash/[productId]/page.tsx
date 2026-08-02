"use client"

import { use, useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { PackageX, Tag, ExternalLink, Star, TrendingDown } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { EmptyState } from "@/components/empty-state"
import { FlashBuyButton } from "@/components/flash-buy-button"
import { PlanSelector } from "@/components/plan-selector"
import { ProductWatchButton } from "@/components/product-watch-button"
import { RichContent, CollapsibleContent } from "@/components/rich-content"
import { DeliveryBadge } from "@/components/delivery-badge"
import { ReviewsSection } from "@/components/reviews-section"
import { ProductQuestions } from "@/components/product-questions"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductDetailShell } from "@/components/product-detail/product-detail-shell"
import { FavoriteButton } from "@/components/product-detail/favorite-button"
import { useI18n } from "@/components/i18n-provider"
import { useReactiveGoldBorder } from "@/hooks/use-reactive-gold-border"
import type { FlashSale } from "@/components/flash-card"
import { getProductDiscount } from "@/lib/core/product-pricing"
import { cn } from "@/lib/utils"

type FlashDetail = FlashSale & {
  subtitle: string | null
  images: string[]
  tags: string[]
  highlights: string[]
  bulkUnitPrice: number | null
  ratingAvg: number | null
  ratingCount: number
  favoritesCount: number
  score: number
  hasScore: boolean
}

export default function FlashDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params)
  const { t, priceValue, priceUsdt, currency, num, dir, locale } = useI18n()
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
      {/* Top region: stock on the reading-start side (green), price on the end
          side. The price stack reads top→bottom: struck-through original, the
          big gold price with its currency word inline, then the USDT (≈ USD)
          crypto reference — matching the approved price-box mockup. */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 text-start">
          <span className="text-xs text-muted-foreground">{t("flash.stock")}</span>
          <span
            className={cn(
              "text-lg font-extrabold tabular-nums",
              soldOut ? "text-destructive" : "text-success",
            )}
          >
            {soldOut ? t("flash.soldOut") : `${num(shownStock)} ${t("detail.remaining")}`}
          </span>
        </div>

        <div className="flex flex-col items-end gap-0.5 text-end">
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through tabular-nums">
              {priceValue(normalizedCompareAt!)} {currency}
            </span>
          )}
          <span className="flex items-baseline gap-1 leading-none text-primary">
            <span className="text-3xl font-extrabold tabular-nums">{priceValue(shownPrice)}</span>
            <span className="text-sm font-bold">{currency}</span>
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground/70">
            USDT {priceUsdt(shownPrice)} ≈
          </span>
        </div>
      </div>

      {/* Savings banner — a soft green panel calling out the buyer's gain,
          replacing the old inline discount pills to match the mockup. */}
      {hasDiscount && (
        <div className="flex items-center justify-start gap-2 rounded-xl border border-success/25 bg-success/10 px-3 py-2.5 text-start">
          <TrendingDown className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-success">
            {t("detail.savePrefix")}{" "}
            <span className="font-extrabold tabular-nums">
              {priceValue(normalizedCompareAt! - normalizedPrice)} {currency}
            </span>{" "}
            <span className="text-success/80">
              ({discountPercent}% {t("flash.off")})
            </span>
          </p>
        </div>
      )}

      {hasBulk && p.bulkUnitPrice != null && !hasPlans && (
        <p className="text-xs text-success">
          {p.bulkMinQty}+ : {t("detail.eachFrom")} {priceValue(p.bulkUnitPrice)} {currency}
        </p>
      )}

      {/* Sale plan selector — collapsible plan picker + comparison. */}
      {hasPlans && (
        <PlanSelector
          variants={variants}
          selectedId={effectiveSelectedId}
          onSelect={setSelectedPlanId}
        />
      )}

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
      subtitle={p.subtitle}
      hero={{
        image: p.images[0] ?? p.coverImage ?? null,
        backHref: "/flash",
        onShare: share,
        watchSlot: <FavoriteButton productId={productId} />,
      }}
      titleMeta={
        <>
          <DeliveryBadge type={shownDelivery} />
          {p.hasScore && (
            <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
              <Star className="size-3 fill-primary text-primary" aria-hidden="true" />
              <span className="tabular-nums">{num(p.score)}</span>
            </span>
          )}
          {!!p.soldDisplay && p.soldDisplay > 0 && (
            <span className="text-[10.5px] tabular-nums text-muted-foreground/70">
              {"\u00B7"} {num(p.soldDisplay)} {t("detail.sales")}
            </span>
          )}
        </>
      }
      primaryPanel={primaryPanel}
      highlights={p.highlights ?? []}
      similarSeedProductId={productId}
      tabs={[
        { id: "info", label: t("detail.tabInfo"), content: infoTab },
        { id: "reviews", label: t("detail.tabReviews"), content: <ReviewsSection productId={productId} /> },
        { id: "questions", label: t("detail.tabQuestions"), content: <ProductQuestions productId={productId} /> },
      ]}
      stickyAction={
        <div dir={dir} className="w-full">
          <FlashBuyButton
            sale={p}
            variant={selectedVariant}
            disabled={hasPlans && !selectedVariant}
            onPurchased={() => mutate()}
            fullWidth
            label={t("flash.buyProduct")}
          />
        </div>
      }
    />
  )
}
