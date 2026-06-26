import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import {
  getGamificationSummary,
  listBadgesForUser,
  listMissionsForUser,
  listPointHistory,
} from "@/lib/core/gamification"

/** Aggregated rewards dashboard payload for the signed-in user. */
export const GET = route(async () => {
  const user = await requireUser()
  const [summary, badges, missions, history] = await Promise.all([
    getGamificationSummary(user.id),
    listBadgesForUser(user.id),
    listMissionsForUser(user.id),
    listPointHistory(user.id),
  ])
  return { summary, badges, missions, history }
})
