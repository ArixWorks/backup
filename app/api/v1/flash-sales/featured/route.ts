import { route } from "@/lib/api/handler"
import { listFeaturedFlashSales } from "@/lib/core/catalog"

export const dynamic = "force-dynamic"

export const GET = route(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  return listFeaturedFlashSales(searchParams.get("locale") ?? "fa")
})
