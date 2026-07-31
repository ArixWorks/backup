import { route } from "@/lib/api/handler"
import { getCurrentUser } from "@/lib/auth/session"
import { recommendForUser } from "@/lib/core/recommendations"

export const dynamic = "force-dynamic"

// Personalized picks. Works for anonymous visitors too (falls back to popular).
export const GET = route(async (req: Request) => {
  const user = await getCurrentUser()
  const { searchParams } = new URL(req.url)
  const limitRaw = Number(searchParams.get("limit") ?? "6")
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 12) : 6
  const locale = searchParams.get("locale") ?? "fa"
  // Optional seed makes this a personalized "similar products" rail for the
  // product being viewed; absent, it's the generic "picked for you" rail.
  const seedProductId = searchParams.get("seed") ?? null
  return recommendForUser(user?.id ?? null, limit, locale, { seedProductId })
})
