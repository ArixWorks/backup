import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { getReferralStats, attachReferral } from "@/lib/core/rewards"
import { getBotConfig } from "@/lib/telegram/settings"
import { clientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

// Current user's referral code + stats (code created lazily on first read).
// Also returns the bot username so the client can build the in-bot deep link.
export const GET = route(async () => {
  const user = await requireUser()
  const [stats, cfg] = await Promise.all([getReferralStats(user.id), getBotConfig()])
  return { ...stats, botUsername: cfg.botUsername ?? null }
})

const schema = z.object({ code: z.string().trim().min(1).max(40) })

// Attach a referrer to the current user via a code (no-op if already referred).
// A web-origin anti-abuse context (hashed IP/subnet/user-agent) is captured so
// the risk engine can later detect same-device / same-network clusters.
export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const { code } = schema.parse(await req.json())
  const result = await attachReferral(user.id, code, {
    source: "web",
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  })
  return result
})
