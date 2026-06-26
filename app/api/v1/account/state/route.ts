import { requireUser } from "@/lib/auth/session"
import { getAccountState } from "@/lib/core/auth-account"
import { route } from "@/lib/api/handler"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Connected auth methods + statuses for the Profile Settings screen. */
export const GET = route(async () => {
  const user = await requireUser()
  return getAccountState(user.id)
})
