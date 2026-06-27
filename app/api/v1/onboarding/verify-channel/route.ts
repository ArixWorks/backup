import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"
import { getBotConfig } from "@/lib/telegram/settings"
import { checkSingleChannel, forcedJoinActive } from "@/lib/telegram/membership"

export const dynamic = "force-dynamic"

/**
 * Verifies the user's membership for a SINGLE required channel. The join gate
 * calls this right after the user returns from visiting a channel, to flip that
 * one channel's tick to green.
 *
 * Returns `{ joined, verifiable }`:
 *  - verifiable=true  → the bot is admin and `joined` is the real Telegram status
 *  - verifiable=false → the bot can't read membership, so `joined` is an
 *    optimistic pass (nothing to enforce).
 *
 * When forced join is off or the account has no Telegram id, everything passes.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
      { status: 401 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as { channelId?: unknown }
  const channelId = typeof body.channelId === "string" ? body.channelId : ""
  if (!channelId) {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "channelId required" } },
      { status: 400 },
    )
  }

  const cfg = await getBotConfig()
  if (!forcedJoinActive(cfg) || !user.telegramId) {
    return NextResponse.json({ ok: true, data: { joined: true, verifiable: false } })
  }

  const result = await checkSingleChannel(cfg, user.telegramId, channelId)
  return NextResponse.json({ ok: true, data: result })
}
