import { NextResponse } from "next/server"
import { createSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db"

// TEMP dev-only QA helper. Deleted after debugging.
export const dynamic = "force-dynamic"

export async function POST() {
  const user = await prisma.user.findFirst({ where: { role: "ADMIN" } })
  if (!user) return NextResponse.json({ ok: false, error: "no user" }, { status: 404 })
  await createSession(user.id)
  return NextResponse.json({ ok: true, userId: user.id })
}
