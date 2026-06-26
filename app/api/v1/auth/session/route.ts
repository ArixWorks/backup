import { NextResponse } from "next/server"
import { getCurrentUser, destroySession } from "@/lib/auth/session"
import { serialize } from "@/lib/serialize"

export const dynamic = "force-dynamic"

/** Returns ONLY the currently authenticated user (never other accounts). */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: true, data: null })
  return NextResponse.json({
    ok: true,
    data: serialize({
      id: user.id,
      displayName: user.displayName,
      alias: user.alias,
      role: user.role,
      status: user.status,
      languageCode: user.languageCode,
      email: user.email,
      emailVerified: user.emailVerified,
      mustChangePassword: user.mustChangePassword,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      photoUrl: user.photoUrl,
      isPremium: user.isPremium,
      balances: user.wallet
        ? {
            totalBalance: user.wallet.totalBalance,
            frozenBalance: user.wallet.frozenBalance,
            availableBalance: user.wallet.totalBalance - user.wallet.frozenBalance,
          }
        : null,
    }),
  })
}

/** Log out: clear the session cookie. */
export async function DELETE() {
  await destroySession()
  return NextResponse.json({ ok: true })
}
