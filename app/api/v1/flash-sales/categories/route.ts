import { route } from "@/lib/api/handler"
import { listFlashCategories } from "@/lib/core/catalog"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  return listFlashCategories()
})
