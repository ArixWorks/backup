import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"
import { getBotConfig } from "@/lib/telegram/settings"
import {
  checkMemberships,
  clearMembershipCache,
  forcedJoinActive,
} from "@/lib/telegram/membership"
import { onChannelMembershipVerified } from "@/lib/core/referral"

export const dynamic = "force-dynamic"

/**
 * Authoritative re-check of the user's membership across every required channel
 * for the standalone channel gate. Always forces a fresh Telegram lookup (cache
 * busted) so a just-joined user is recognised immediately, letting the gate
 * continue to the dashboard without a page refresh.
 *
 * When forced join is off or the account has no Telegram id, the gate passes.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
      { status: 401 },
    )
  }

  const cfg = await getBotConfig()
  if (!forcedJoinActive(cfg) || !user.telegramId) {
    return NextResponse.json({ ok: true, data: { passed: true, missing: [] } })
  }

  await clearMembershipCache(user.telegramId)
  const result = await checkMemberships(cfg, user.telegramId, { force: true })

  // The user just passed the mandatory channel gate → validate any pending
  // referral (notify direct inviter, trigger Level-2 reward). Idempotent and
  // best-effort so it can never block the gate response.
  if (result.ok) {
    void onChannelMembershipVerified(user.id).catch((e) =>
      console.log("[v0] channels/verify referral bridge error:", (e as Error).message),
    )
  }

  return NextResponse.json({
    ok: true,
    data: {
      passed: result.ok,
      missing: result.missing.map((ch) => ({ id: ch.id, title: ch.title, url: ch.url })),
    },
  })
}
