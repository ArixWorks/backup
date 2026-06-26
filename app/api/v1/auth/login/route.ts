import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { verifyPassword, needsRehash, hashPassword } from "@/lib/auth/password"
import { createSession } from "@/lib/auth/session"
import { recordAuthEvent } from "@/lib/core/auth-account"
import { checkRateLimit, clientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
})

function rateLimited(retryAfter: number) {
  return NextResponse.json(
    { ok: false, error: { code: "RATE_LIMITED", message: "تلاش‌های ناموفق زیاد بود. کمی بعد دوباره امتحان کنید." } },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  )
}

/** Email + password sign-in. */
export async function POST(req: Request) {
  // Brute-force protection: cap attempts per client IP before doing any work.
  const ipLimit = await checkRateLimit({ bucket: "auth:login:ip", identifier: clientIp(req), limit: 20, windowSec: 600 })
  if (!ipLimit.ok) return rateLimited(ipLimit.retryAfter)

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "ورودی نامعتبر است" } },
      { status: 400 },
    )
  }

  const email = body.email.toLowerCase().trim()

  // Also cap attempts per target account to slow credential stuffing.
  const emailLimit = await checkRateLimit({ bucket: "auth:login:email", identifier: email, limit: 10, windowSec: 600 })
  if (!emailLimit.ok) return rateLimited(emailLimit.retryAfter)
  const user = await prisma.user.findUnique({ where: { email } })
  // verifyPassword handles a null hash safely (returns false).
  const valid = await verifyPassword(body.password, user?.passwordHash)
  if (!user || !valid) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "ایمیل یا رمز عبور اشتباه است" } },
      { status: 401 },
    )
  }

  if (user.status === "BANNED") {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "این حساب مسدود شده است" } },
      { status: 403 },
    )
  }

  // Transparently upgrade legacy (scrypt) or outdated hashes to current Argon2id.
  const rehash = needsRehash(user.passwordHash) ? await hashPassword(body.password) : undefined
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginMethod: "password", ...(rehash ? { passwordHash: rehash } : {}) },
  })
  await recordAuthEvent(user.id, "login.password")

  await createSession(user.id, user.tokenVersion)
  return NextResponse.json({
    ok: true,
    data: { id: user.id, mustChangePassword: user.mustChangePassword },
  })
}
