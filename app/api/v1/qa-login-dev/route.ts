import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createSession } from "@/lib/auth/session"

// TEMPORARY dev-only route for browser QA. Deleted immediately after use.
export const dynamic = "force-dynamic"

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled" }, { status: 404 })
  }
  const email = process.env.QA_USER_EMAIL
  if (!email) return NextResponse.json({ error: "no QA_USER_EMAIL" }, { status: 400 })
  const user = await prisma.user.findFirst({ where: { email } })
  if (!user) return NextResponse.json({ error: "QA user not found" }, { status: 404 })
  await createSession(user.id, user.tokenVersion ?? 0)
  return NextResponse.json({ ok: true, userId: user.id })
}
