import { NextResponse } from "next/server"
import { verifyLoginWidget } from "@/lib/telegram/verify"
import { resolveTelegramUser } from "@/lib/telegram/user"
import { createSession } from "@/lib/auth/session"
import { cacheTelegramAvatar } from "@/lib/auth/avatar"
import { checkRateLimit, clientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Browser login via the Telegram Login Widget. The widget posts a signed
 * payload (id, first_name, username, photo_url, auth_date, hash). We verify the
 * HMAC, find-or-create the user, mirror the avatar to Blob, and start a signed
 * session.
 */
export async function POST(req: Request) {
  // Throttle widget-login attempts per IP to deter forged-hash probing.
  const ipLimit = await checkRateLimit({ bucket: "auth:tg:ip", identifier: clientIp(req), limit: 30, windowSec: 600 })
  if (!ipLimit.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "too many attempts" } },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } },
    )
  }

  let data: Record<string, unknown>
  try {
    data = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "invalid payload" } },
      { status: 400 },
    )
  }

  const result = verifyLoginWidget(data)
  if (!result.ok || !result.user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: result.reason || "invalid login" } },
      { status: 401 },
    )
  }

  const user = await resolveTelegramUser({ ...result.user, chatId: result.user.id })

  if (result.user.photo_url && user.telegramId) {
    await cacheTelegramAvatar({
      userId: user.id,
      telegramId: user.telegramId,
      photoUrl: result.user.photo_url,
    })
  }

  // Embed the user's current tokenVersion so accounts whose version was bumped
  // (e.g. the owner via create-admin, or "log out of all sessions") get a valid
  // session instead of one getCurrentUser instantly rejects.
  await createSession(user.id, user.tokenVersion ?? 0)
  return NextResponse.json({ ok: true, data: { id: user.id } })
}
