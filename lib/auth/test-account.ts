import "server-only"
import { ForbiddenError } from "@/lib/core/errors"
import { getCurrentUser } from "@/lib/auth/session"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

const BLOCKED_MUTATION_PREFIXES = [
  "/api/v1/wallet",
  "/api/v1/refunds",
  "/api/v1/rewards",
  "/api/v1/referral",
  "/api/v1/giveaways/enter",
  "/api/v1/auctions/bid",
  "/api/v1/domains/checkout",
  "/api/v1/domains/orders",
  "/api/v1/flash-sales/checkout",
  "/api/v1/orders",
]

const BLOCKED_ADMIN_SEGMENTS = [
  "/draw",
  "/deliver",
  "/wallet",
  "/refund",
  "/withdraw",
  "/deposit",
  "/broadcast",
]

/**
 * Automation accounts may inspect real UI in Preview and Production but cannot
 * create financial, reward, giveaway, winner, or broadcast side effects.
 */
export async function enforceTestAccountMutationBoundary(request: Request) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return

  const user = await getCurrentUser()
  if (!user?.isTestAccount) return

  const pathname = new URL(request.url).pathname
  const blocked =
    BLOCKED_MUTATION_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    (pathname.startsWith("/api/v1/admin/") && BLOCKED_ADMIN_SEGMENTS.some((segment) => pathname.includes(segment)))

  if (blocked) {
    throw new ForbiddenError("Automation test accounts cannot perform this operation")
  }
}
