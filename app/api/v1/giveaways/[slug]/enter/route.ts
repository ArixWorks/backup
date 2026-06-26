import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { enterGiveaway, MembershipRequiredError } from "@/lib/core/giveaway"
import { prisma } from "@/lib/db"
import { NotFoundError } from "@/lib/core/errors"
import { rateLimitBy } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

// Enter the current user into a giveaway. The core enforces eligibility
// (forced-channel membership), one-entry-per-user, and the lifecycle window.
// A membership gap is returned as { ok: true, joined: false, missing: [...] }
// so the client can render the join-channel buttons (not treated as an error).
export const POST = route(async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const user = await requireUser()
  // Throttle entry attempts (the core still enforces one entry per user).
  await rateLimitBy(user.id, { bucket: "giveaway:enter", limit: 30, windowSec: 60 })
  const { slug } = await params
  const g = await prisma.giveaway.findUnique({ where: { slug }, select: { id: true } })
  if (!g) throw new NotFoundError("قرعه‌کشی یافت نشد")
  try {
    const { created } = await enterGiveaway({ giveawayId: g.id, userId: user.id, source: "WEB" })
    return { joined: true, created, missing: [] }
  } catch (err) {
    if (err instanceof MembershipRequiredError) {
      return { joined: false, created: false, missing: err.missing }
    }
    throw err
  }
})
