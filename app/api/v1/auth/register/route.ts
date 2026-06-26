import { NextResponse } from "next/server"
import { z } from "zod"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth/password"
import { createSession } from "@/lib/auth/session"
import { startEmailVerification } from "@/lib/core/auth-account"
import { checkRateLimit, clientIp } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(60).optional(),
})

/** Email + password sign-up. Creates the user and wallet, then starts a session. */
export async function POST(req: Request) {
  // Cap account creation per IP to curb spam/abuse signups.
  const ipLimit = await checkRateLimit({ bucket: "auth:register:ip", identifier: clientIp(req), limit: 10, windowSec: 3600 })
  if (!ipLimit.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "RATE_LIMITED", message: "تعداد ثبت‌نام بیش از حد مجاز است. کمی بعد دوباره امتحان کنید." } },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } },
    )
  }

  let body: z.infer<typeof schema>
  try {
    body = schema.parse(await req.json())
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_REQUEST", message: "ایمیل یا رمز عبور نامعتبر است" } },
      { status: 400 },
    )
  }

  const email = body.email.toLowerCase().trim()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { ok: false, error: { code: "CONFLICT", message: "این ایمیل قبلاً ثبت شده است" } },
      { status: 409 },
    )
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(body.password),
      emailVerified: false,
      lastLoginMethod: "password",
      displayName: body.displayName?.trim() || email.split("@")[0],
      alias: `Bidder#${randomBytes(2).toString("hex")}`,
      wallets: { create: { currency: "IRT", totalBalance: 0n } },
    },
  })

  // Send a verification email (best-effort — sign-up still succeeds if email fails).
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
    await startEmailVerification({ userId: user.id, email, origin })
  } catch (e) {
    console.log("[v0] register: verification email failed:", (e as Error).message)
  }

  await createSession(user.id)
  return NextResponse.json({ ok: true, data: { id: user.id } })
}
