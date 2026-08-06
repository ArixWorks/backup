// TEMPORARY: dev-only QA sign-in used for browser verification. Deleted after use.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createSession } from "@/lib/auth/session"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  const email = process.env.QA_USER_EMAIL
  if (!email) return NextResponse.json({ error: "QA_USER_EMAIL unset" }, { status: 500 })

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, tokenVersion: true } })
  if (!user) return NextResponse.json({ error: "QA user not found" }, { status: 404 })

  await createSession(user.id, user.tokenVersion ?? 0)
  return NextResponse.json({ ok: true })
}
