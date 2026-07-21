import { NextResponse } from "next/server"
import { getCurrentUser, destroySession } from "@/lib/auth/session"
import { recordDailyLogin, tierDiscountPercent } from "@/lib/core/gamification"
import { effectiveTier, isVipActive, normalizeEarnedTier } from "@/lib/tiers"
import { serialize } from "@/lib/serialize"

export const dynamic = "force-dynamic"

/** Returns ONLY the currently authenticated user (never other accounts). */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: true, data: null })
  // Count one daily login per day (idempotent, best-effort — never blocks the
  // response or throws). Captures web, web-app and Telegram entry uniformly.
  if (!user.isTestAccount) recordDailyLogin(user.id).catch(() => {})
  // Base-currency wallet (eager-loaded in getCurrentUser); may be absent for new users.
  const baseWallet = user.wallets?.[0] ?? null
  // Effective membership tier (VIP when an active manual grant exists) so the
  // whole client app renders a consistent tier badge + perks.
  const tier = effectiveTier(user)
  const membership = {
    tier,
    earnedTier: normalizeEarnedTier(user.vipTier),
    vipActive: isVipActive(user),
    vipManualExpiresAt: user.vipManualExpiresAt,
    discountPercent: await tierDiscountPercent(tier),
  }
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
      membership,
      balances: baseWallet
        ? {
            totalBalance: baseWallet.totalBalance,
            frozenBalance: baseWallet.frozenBalance,
            availableBalance: baseWallet.totalBalance - baseWallet.frozenBalance,
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
