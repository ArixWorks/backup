import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listWatchlist } from "@/lib/core/watchlist"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const user = await requireUser()
  return listWatchlist(user.id)
})
