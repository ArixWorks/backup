import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * Marks the first-run onboarding flow as finished. Idempotent: re-calling after
 * onboarding is already complete is a no-op and still returns ok.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
      { status: 401 },
    )
  }

  if (!user.onboardedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardedAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true, data: { onboarded: true } })
}
