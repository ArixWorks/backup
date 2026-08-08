import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createSession } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export async function POST() {
  const user = await prisma.user.findFirst({ where: { role: "ADMIN" } })
  if (!user) return NextResponse.json({ ok: false, error: "no admin" }, { status: 404 })
  await createSession(user.id, user.tokenVersion ?? 0)
  return NextResponse.json({ ok: true, userId: user.id })
}
