import "server-only"
import { timingSafeEqual } from "node:crypto"
import { ForbiddenError } from "@/lib/core/errors"

/**
 * Authenticate scheduler (cron) requests.
 *
 * Fail-closed policy: in production a missing CRON_SECRET rejects every
 * request — the endpoints trigger backups, auction finalization and the email
 * queue, so they must never be publicly callable. In dev/preview (no secret
 * set) requests are allowed so local testing keeps working.
 *
 * The comparison is constant-time to avoid leaking the secret via timing.
 */
export function requireCronAuth(req: Request): void {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenError("CRON_SECRET is not configured")
    }
    return // dev/preview: allow for local testing
  }
  const auth = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  const a = Buffer.from(auth)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ForbiddenError("Invalid cron secret")
  }
}
