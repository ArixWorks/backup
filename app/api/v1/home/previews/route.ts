import { route } from "@/lib/api/handler"
import { listFlashSales, listAuctions } from "@/lib/core/catalog"
import { listTlds } from "@/lib/core/domains/service"
import { deriveAuctionDisplayState } from "@/lib/core/auction/display-state"
import type { HomePreviewItem } from "@/lib/home/service-previews"

export const dynamic = "force-dynamic"

/**
 * Preview payload for the home "service folder" cards. Each folder fans out at
 * most three real items, so we only ship the handful of fields a tiny preview
 * card renders: a destination, a label, an optional cover image and a price.
 */
const PREVIEW_COUNT = 3

export const GET = route(async (req: Request) => {
  const locale = new URL(req.url).searchParams.get("locale") ?? "fa"

  // Three independent reads — run them together so the home page pays for the
  // slowest one rather than the sum.
  const [products, auctions, tlds] = await Promise.all([
    // `sort: "popular"` ranks by the publicly displayed sold count
    // (real sales + admin baseline), which is exactly the "top sellers" rule.
    listFlashSales({ sort: "popular", locale }),
    listAuctions(locale),
    listTlds(),
  ])

  const store: HomePreviewItem[] = products.slice(0, PREVIEW_COUNT).map((p) => ({
    id: p.id,
    href: `/flash/${p.slug || p.id}`,
    label: p.title,
    image: p.coverImage,
    priceIrt: p.price != null ? p.price.toString() : null,
    note: p.soldDisplay > 0 ? String(p.soldDisplay) : null,
  }))

  // Auctions are already ordered live → scheduled → ended by `listAuctions`, so
  // the first three are the most relevant ones to advertise.
  const auctionItems: HomePreviewItem[] = auctions.slice(0, PREVIEW_COUNT).map((a) => {
    const state = deriveAuctionDisplayState({
      status: a.status,
      endReason: a.endReason,
      finalPrice: a.finalPrice != null ? Number(a.finalPrice) : null,
      bidCount: a.bidCount,
    })
    return {
      id: a.id,
      href: `/auctions/${a.slug || a.id}`,
      label: a.title,
      image: a.coverImage,
      priceIrt: a.currentPrice != null ? a.currentPrice.toString() : null,
      note: state.isLive ? String(a.bidCount) : null,
    }
  })

  // Only extensions we can actually sell, in the admin's display order.
  const domains: HomePreviewItem[] = tlds
    .filter((t) => t.supported)
    .slice(0, PREVIEW_COUNT)
    .map((t) => ({
      id: t.id,
      // `?ext=` is the existing prefill contract the domain marketplace reads,
      // so the search box lands pre-seeded with the chosen extension.
      href: `/domains?ext=${encodeURIComponent(t.tld)}`,
      label: t.tld,
      image: null,
      priceIrt: t.basePriceIrt != null ? t.basePriceIrt.toString() : null,
      note: null,
    }))

  return { store, auctions: auctionItems, domains, vps: [] as HomePreviewItem[] }
})
