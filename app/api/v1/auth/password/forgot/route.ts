import { z } from "zod"
import { requestPasswordReset } from "@/lib/core/auth-account"
import { route } from "@/lib/api/handler"
import { assertSameOrigin } from "@/lib/api/csrf"
import { rateLimitByIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ email: z.string().email() })

/** Request a password-reset email. Always returns ok (no account enumeration). */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req)
  // Throttle reset-email requests to curb spam/enumeration probing.
  await rateLimitByIp(req, { bucket: "auth:forgot", limit: 5, windowSec: 600 })
  const body = schema.parse(await req.json())
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  return requestPasswordReset(body.email, origin)
})
