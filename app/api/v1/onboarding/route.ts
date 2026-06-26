import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"
import { getBotConfig } from "@/lib/telegram/settings"
import { forcedJoinActive } from "@/lib/telegram/membership"

export const dynamic = "force-dynamic"

/**
 * First-run onboarding status for the signed-in user. The client uses this to
 * decide whether to show the onboarding flow (join gate → language → tutorial →
 * success) and which required channels to render on the join gate.
 *
 * Only public, non-sensitive channel metadata (title + join url) is exposed.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
      { status: 401 },
    )
  }

  const cfg = await getBotConfig()
  const joinEnabled = forcedJoinActive(cfg)
  // Whether THIS user can actually be membership-checked (needs a Telegram id).
  const canVerify = joinEnabled && Boolean(user.telegramId)

  const channels = (joinEnabled ? cfg.requiredChannels ?? [] : [])
    .filter((ch) => ch && ch.id && ch.id.trim())
    .map((ch) => ({ id: ch.id, title: ch.title, url: ch.url }))

  return NextResponse.json({
    ok: true,
    data: {
      needsOnboarding: !user.onboardedAt,
      joinEnabled,
      canVerify,
      channels,
      brandName: cfg.brandName,
    },
  })
}
