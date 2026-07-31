"use client"

import type { ReactNode } from "react"
import { Reveal } from "@/components/motion"
import { ProductHero } from "@/components/product-detail/product-hero"
import { ProductHighlights } from "@/components/product-detail/product-highlights"
import { SegmentedTabs, type SegmentedTab } from "@/components/product-detail/segmented-tabs"
import { StickyBuyBar } from "@/components/product-detail/sticky-buy-bar"
import { SimilarProductsRail } from "@/components/product-detail/similar-products-rail"

/**
 * The one shared product-detail template, applied to BOTH the shop (fixed
 * price) and auction experiences. It owns the immersive layout, the features
 * checklist, the tabbed long-form sections, the personalized similar-products
 * rail, and the fixed bottom purchase bar — while every domain-specific piece
 * (pricing panel, plan selector, bid panel, buy bar contents) is injected via
 * slots so each page stays in control of its own logic.
 *
 * Consumers are responsible for hiding the app bottom-nav on their route (the
 * sticky bar owns the bottom edge here).
 */
export function ProductDetailShell({
  hero,
  title,
  titleMeta,
  headerAside,
  banner,
  primaryPanel,
  highlights,
  tabs,
  similarSeedProductId,
  stickyInfo,
  stickyAction,
  extraSections,
}: {
  /** Props forwarded to the immersive hero. */
  hero: {
    image: string | null
    backHref: string
    onShare?: () => void
    watchSlot?: ReactNode
    overlay?: ReactNode
    treatmentClass?: string
  }
  title: string
  /** Row under the title: badges, delivery, rating, category, etc. */
  titleMeta?: ReactNode
  /** Optional control aligned to the title's end (e.g. web watch button). */
  headerAside?: ReactNode
  /** Full-width banner above the grid (e.g. auction terminal outcome). */
  banner?: ReactNode
  /**
   * The domain panel shown on the end column at web-desktop widths and inline
   * (below highlights) on mobile — pricing box, plan selector, bid panel, etc.
   */
  primaryPanel: ReactNode
  highlights: string[]
  tabs: SegmentedTab[]
  /** Seeds the personalized "similar products" rail; omit to hide the rail. */
  similarSeedProductId?: string | null
  /** Sticky bottom bar contents. */
  stickyInfo: ReactNode
  stickyAction: ReactNode
  /** Any extra domain sections placed before the tabs (e.g. bid history). */
  extraSections?: ReactNode
}) {
  return (
    // Bottom padding clears the fixed buy bar (the app nav is hidden here).
    <div className="space-y-6 pb-28">
      <ProductHero title={title} {...hero} />

      {/* Title + meta sit right under the hero, reading as a continuation of
          the faded image. */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 dir="auto" className="text-balance text-2xl font-extrabold leading-tight sm:text-3xl">
            {title}
          </h1>
          {headerAside && <div className="shrink-0">{headerAside}</div>}
        </div>
        {titleMeta && <div className="flex flex-wrap items-center gap-2">{titleMeta}</div>}
      </div>

      {banner}

      {/*
        Single-instance layout: the domain panel (which may hold a live BidPanel
        or stateful PlanSelector) is rendered exactly ONCE, then repositioned
        with flex order across breakpoints — inline after highlights on mobile,
        and into a sticky end column on the web desktop shell. Rendering it twice
        would duplicate side-effecting children.
      */}
      <div className="flex flex-col gap-6 web:lg:flex-row web:lg:items-start">
        {/* Main column */}
        <div className="order-2 min-w-0 flex-1 space-y-6 web:lg:order-1">
          <div className="hidden web:lg:block">
            <ProductHighlights items={highlights} />
          </div>

          {extraSections}

          <SegmentedTabs tabs={tabs} />
        </div>

        {/* Domain panel — inline on mobile (after the mobile highlights below),
            sticky end column on web desktop. */}
        <div className="order-1 min-w-0 space-y-6 web:lg:order-2 web:lg:sticky web:lg:top-20 web:lg:w-[22rem] web:lg:shrink-0 web:lg:self-start">
          <div className="web:lg:hidden">
            <ProductHighlights items={highlights} />
          </div>
          {primaryPanel}
        </div>
      </div>

      {similarSeedProductId && (
        <Reveal>
          <SimilarProductsRail productId={similarSeedProductId} />
        </Reveal>
      )}

      <StickyBuyBar info={stickyInfo} action={stickyAction} />
    </div>
  )
}
