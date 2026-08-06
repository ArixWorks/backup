import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { SESSION_COOKIE } from "@/lib/auth/session"
import { signSession } from "@/lib/auth/token"

// TEMPORARY QA-only route. Deleted right after browser verification.
export const dynamic = "force-dynamic"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 })
  }
  const email = process.env.QA_USER_EMAIL?.toLowerCase().trim()
  if (!email) return NextResponse.json({ error: "QA_USER_EMAIL missing" }, { status: 500 })
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, tokenVersion: true, role: true } })
  if (!user) return NextResponse.json({ error: "QA user not found" }, { status: 404 })

  const res = NextResponse.json({ ok: true, role: user.role })
  // secure:false so a plain-http localhost browser actually retains it.
  res.cookies.set(SESSION_COOKIE, signSession(user.id, user.tokenVersion ?? 0), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 86_400,
  })
  return res
}
