import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * TEMPORARY QA-only helper. Signs the browser in as the QA USER account using
 * server-side env credentials so automated visual checks never carry secrets
 * through the shell. Refuses to run outside development. Delete after use.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 404 })
  }
  const email = process.env.QA_USER_EMAIL?.toLowerCase().trim()
  if (!email) return NextResponse.json({ ok: false, error: "no QA_USER_EMAIL" }, { status: 500 })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ ok: false, error: "QA user not found" }, { status: 404 })

  await createSession(user.id, user.tokenVersion)
  return NextResponse.json({ ok: true, email: user.email, role: user.role })
}
