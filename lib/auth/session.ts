import "server-only"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { ForbiddenError, UnauthorizedError } from "@/lib/core/errors"
import { BASE_CURRENCY } from "@/lib/core/ledger"
import { signSession, verifySession, SESSION_TTL_SECONDS } from "./token"

/**
 * Identity layer. The session cookie holds a *signed* token (HMAC) rather than
 * a raw user id, so the value cannot be edited to impersonate another account.
 * The same API is shared by the web app, bot and Mini App.
 */
export const SESSION_COOKIE = "subio_session"
// Legacy cookie (raw uid) — read once for backwards compat, then ignored.
const LEGACY_COOKIE = "subio_uid"

export async function currentUserId(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  const payload = verifySession(token)
  if (payload) return payload.uid
  // Note: legacy raw-uid cookies are intentionally NOT trusted anymore.
  return null
}

export async function getCurrentUser() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  const payload = verifySession(token)
  if (!payload) return null
  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    include: { wallets: { where: { currency: BASE_CURRENCY }, take: 1 } },
  })
  if (!user) return null
  // Enforce "log out from all sessions": a bumped tokenVersion invalidates every
  // session token issued before the bump.
  if ((user.tokenVersion ?? 0) !== payload.ver) return null
  return user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError("Authentication required")
  // A user banned *after* logging in must be rejected on their next request,
  // even though their signed session token is still cryptographically valid.
  if (user.status === "BANNED") throw new ForbiddenError("این حساب مسدود شده است")
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== "ADMIN") throw new ForbiddenError("Admin access required")
  return user
}

/** Issue a signed session cookie for the given user (call after login). */
export async function createSession(userId: string, tokenVersion = 0) {
  const store = await cookies()
  store.set(SESSION_COOKIE, signSession(userId, tokenVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
}

/** Clear the session (logout), including any legacy cookie. */
export async function destroySession() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  store.delete(LEGACY_COOKIE)
}
