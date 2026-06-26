import { z } from "zod"
import { resetPassword } from "@/lib/core/auth-account"
import { route } from "@/lib/api/handler"
import { assertSameOrigin } from "@/lib/api/csrf"
import { rateLimitByIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
})

/** Complete a password reset using a verified-email token. */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req)
  // Throttle reset attempts to prevent brute-forcing the token.
  await rateLimitByIp(req, { bucket: "auth:reset", limit: 10, windowSec: 600 })
  const body = schema.parse(await req.json())
  return resetPassword(body.token, body.password)
})
