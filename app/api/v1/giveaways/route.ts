import { route } from "@/lib/api/handler"
import { listPublicGiveaways } from "@/lib/core/giveaway"

export const dynamic = "force-dynamic"

// Public, unauthenticated list of visible giveaways (active + finished).
export const GET = route(async (req: Request) => {
  const locale = new URL(req.url).searchParams.get("locale") ?? "fa"
  return listPublicGiveaways(locale)
})
