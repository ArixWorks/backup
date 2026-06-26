import { route } from "@/lib/api/handler"
import { listFollowedCategories } from "@/lib/core/category-follows"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const categories = await listFollowedCategories()
  return { categories }
})
