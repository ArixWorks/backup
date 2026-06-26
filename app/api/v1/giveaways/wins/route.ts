import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listUserWins } from "@/lib/core/giveaway"

export const dynamic = "force-dynamic"

// The signed-in user's own giveaway wins, including private claim data.
export const GET = route(async () => {
  const user = await requireUser()
  return listUserWins(user.id)
})
