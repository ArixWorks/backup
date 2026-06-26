import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { getReferralStats, attachReferral } from "@/lib/core/rewards"
import { getBotConfig } from "@/lib/telegram/settings"

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
export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const { code } = schema.parse(await req.json())
  const attached = await attachReferral(user.id, code)
  return { attached }
})
