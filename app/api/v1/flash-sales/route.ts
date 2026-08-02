import { route } from "@/lib/api/handler"
import { listFlashSales, type FlashSort } from "@/lib/core/catalog"

export const dynamic = "force-dynamic"

function parsePrice(value: string | null): bigint | undefined {
  if (!value) return undefined
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return undefined
  return BigInt(Math.floor(n))
}

export const GET = route(async (req: Request) => {
  const { searchParams } = new URL(req.url)
  return listFlashSales({
    search: searchParams.get("search") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    sort: (searchParams.get("sort") as FlashSort | null) ?? undefined,
    locale: searchParams.get("locale") ?? "fa",
    minPrice: parsePrice(searchParams.get("minPrice")),
    maxPrice: parsePrice(searchParams.get("maxPrice")),
    inStockOnly: searchParams.get("inStock") === "1",
    instantOnly: searchParams.get("instant") === "1",
  })
})
