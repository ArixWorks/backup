import { route } from "@/lib/api/handler"
import { listFlashSales, type FlashSort } from "@/lib/core/catalog"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  const { searchParams } = new URL(req.url)
  return listFlashSales({
    search: searchParams.get("search") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    sort: (searchParams.get("sort") as FlashSort | null) ?? undefined,
  })
})
