import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listFavorites } from "@/lib/core/favorites"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const user = await requireUser()
  return listFavorites(user.id)
})
