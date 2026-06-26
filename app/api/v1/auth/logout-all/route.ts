import { requireUser, createSession } from "@/lib/auth/session"
import { logoutAllSessions } from "@/lib/core/auth-account"
import { route } from "@/lib/api/handler"
import { assertSameOrigin } from "@/lib/api/csrf"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Log out from all sessions by bumping the user's token version (invalidating
 * every previously issued cookie), then re-issue a fresh session for THIS
 * device so the current user stays signed in here.
 */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req)
  const user = await requireUser()
  const newVersion = await logoutAllSessions(user.id)
  await createSession(user.id, newVersion)
  return { ok: true }
})
