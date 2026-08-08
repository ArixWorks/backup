import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

// TEMP dev-only QA login for browser inspection. Deleted after QA.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 403 })
  }
  const email = process.env.QA_USER_EMAIL
  if (!email) return NextResponse.json({ ok: false, error: "no QA email" }, { status: 500 })
  const user = await prisma.user.findFirst({ where: { email } })
  if (!user) return NextResponse.json({ ok: false, error: "QA user not found" }, { status: 404 })
  await createSession(user.id, user.tokenVersion ?? 0)
  return NextResponse.json({ ok: true, userId: user.id })
}
