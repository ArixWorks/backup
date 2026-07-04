import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"
import { getBotConfig } from "@/lib/telegram/settings"
import {
  checkMemberships,
  forcedJoinActive,
  getEnrichedChannels,
} from "@/lib/telegram/membership"

export const dynamic = "force-dynamic"

/**
 * Status for the standalone channel-membership gate — a dedicated verification
 * screen shown AFTER auth + language selection (not part of onboarding). The
 * client uses `passed` to decide whether to skip the gate entirely:
 *
 *  - forced join disabled, or account can't be membership-checked → passed=true
 *    (never dead-end a web/password-only user).
 *  - already a member of every required channel → passed=true (skip the screen).
 *  - otherwise passed=false and the enriched channels are returned so the gate
 *    can render premium join cards (title, description, subscriber count).
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
  const enabled = forcedJoinActive(cfg)
  const canVerify = enabled && Boolean(user.telegramId)

  if (!enabled || !canVerify) {
    return NextResponse.json({
      ok: true,
      data: {
        enabled,
        canVerify,
        passed: true,
        channels: [],
        brandName: cfg.brandName,
      },
    })
  }

  const result = await checkMemberships(cfg, user.telegramId!)
  const passed = result.ok
  // Only pay for the extra Telegram metadata calls when we actually need to
  // render the gate (i.e. the user still has channels to join).
  const channels = passed ? [] : await getEnrichedChannels(cfg)

  return NextResponse.json({
    ok: true,
    data: {
      enabled,
      canVerify,
      passed,
      channels,
      brandName: cfg.brandName,
    },
  })
}
