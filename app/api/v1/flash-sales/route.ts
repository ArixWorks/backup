import { route } from "@/lib/api/handler"
import { searchFlashSalesWithSuggestions, type FlashSort } from "@/lib/core/catalog"
import { currentUserId } from "@/lib/auth/session"
import { logSearch } from "@/lib/core/search-log"

export const dynamic = "force-dynamic"

function parsePrice(value: string | null): bigint | undefined {
  if (!value) return undefined
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return undefined
  return BigInt(Math.floor(n))
}

export const GET = route(async (req: Request) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search")?.trim() || undefined
  const locale = searchParams.get("locale") ?? "fa"
  // "telegram" is passed by the Mini App shell so admin insights can split
  // demand by surface; everything else is treated as the web storefront.
  const source = searchParams.get("source") === "telegram" ? "TELEGRAM" : "WEB"

  const result = await searchFlashSalesWithSuggestions({
    search,
    category: searchParams.get("category") ?? undefined,
    sort: (searchParams.get("sort") as FlashSort | null) ?? undefined,
    locale,
    minPrice: parsePrice(searchParams.get("minPrice")),
    maxPrice: parsePrice(searchParams.get("maxPrice")),
    inStockOnly: searchParams.get("inStock") === "1",
    instantOnly: searchParams.get("instant") === "1",
  })

  // Log real user searches for the admin insights panel. Fire-and-forget so a
  // slow/failed insert never affects search latency or the response.
  if (search) {
    const userId = (await currentUserId()) ?? null
    void logSearch({
      query: search,
      resultCount: result.exactCount,
      suggested: result.suggestions.length > 0,
      source,
      locale,
      userId,
    })
  }

  return {
    items: result.items,
    suggestions: result.suggestions,
    exactCount: result.exactCount,
  }
})
