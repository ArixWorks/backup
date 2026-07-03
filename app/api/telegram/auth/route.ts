import { NextResponse } from "next/server"
import { z } from "zod"
import { verifyInitData } from "@/lib/telegram/verify"
import { resolveTelegramUser } from "@/lib/telegram/user"
import { SESSION_COOKIE } from "@/lib/auth/session"
import { signSession, SESSION_TTL_SECONDS } from "@/lib/auth/token"
import { cacheTelegramAvatar } from "@/lib/auth/avatar"
import { serialize } from "@/lib/serialize"
import { checkRateLimit, clientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({ initData: z.string().min(1) })

/**
 * Mini App login. The client sends Telegram WebApp.initData; we verify its
 * HMAC signature, then find-or-create the matching user and set the shared
 * session cookie so every existing API works unchanged inside Telegram.
 */
export async function POST(req: Request) {
  // Throttle initData verification per IP to deter forged-signature probing.
  const ipLimit = await checkRateLimit({ bucket: "auth:miniapp:ip", identifier: clientIp(req), limit: 30, windowSec: 600 })
  if (!ipLimit.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "too many attempts" } },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } },
    )
  }

  let body: { initData: string }
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "initData required" } },
      { status: 400 },
    )
  }

  const result = verifyInitData(body.initData)
  if (!result.ok || !result.user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: result.reason || "invalid initData" } },
      { status: 401 },
    )
  }

  const user = await resolveTelegramUser({ ...result.user, chatId: result.user.id })

  // Mirror the Telegram avatar into Blob for a stable, fast URL (best-effort).
  let photoUrl = user.photoUrl
  if (result.user.photo_url && user.telegramId) {
    photoUrl =
      (await cacheTelegramAvatar({
        userId: user.id,
        telegramId: user.telegramId,
        photoUrl: result.user.photo_url,
      })) ?? photoUrl
  }

  const res = NextResponse.json({
    ok: true,
    data: serialize({
      id: user.id,
      displayName: user.displayName,
      alias: user.alias,
      role: user.role,
      photoUrl,
      isPremium: user.isPremium,
    }),
  })
  // Signed session token (cannot be forged by editing the cookie). sameSite
  // "none" keeps it working inside the Telegram Mini App iframe. The user's
  // current tokenVersion MUST be embedded — otherwise any account whose version
  // was bumped (e.g. the owner via create-admin, or anyone who used "log out of
  // all sessions") would get a token that getCurrentUser instantly rejects,
  // leaving the Mini App stuck on an infinite loader.
  res.cookies.set(SESSION_COOKIE, signSession(user.id, user.tokenVersion ?? 0), {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
  return res
}
