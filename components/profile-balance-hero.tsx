"use client"

import Link from "next/link"
import { Activity, Wallet } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { MembershipBadge } from "@/components/membership-badge"
import { PremiumHeroCard } from "@/components/premium-hero-card"

/**
 * The dashboard signature surface: a single compact, horizontal "wallet card"
 * that fuses the user's identity (avatar · name · @handle · membership tier)
 * on one end with their wallet balance + a live-activity shortcut on the other.
 *
 * Built on the reusable `PremiumHeroCard` (frozen cinematic utilities +
 * tier-aware `LivingSurface`), so the whole card reskins automatically with the
 * user's active membership tier. All ambient motion is decoration-only and
 * auto-tuned by the app's motion tiers / OS Reduce-Motion.
 */
export function ProfileBalanceHero() {
  const { user } = useSession()
  const { t, priceValue, currency } = useI18n()

  const initials = (user?.displayName ?? "?").slice(0, 2)
  const handle = user?.telegramUsername ?? user?.alias ?? null

  return (
    <PremiumHeroCard aria-label={t("home.welcome")}>
      {/* ── Content row ── */}
      <div className="flex items-center justify-between gap-3">
        {/* Identity cluster */}
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative shrink-0">
            {/* glowing gold ring frame */}
            <span
              aria-hidden
              className="bg-gold absolute -inset-0.5 rounded-full opacity-90 blur-[1px]"
            />
            <Avatar className="relative h-12 w-12 border-2 border-background sm:h-14 sm:w-14">
              {user?.photoUrl && <AvatarImage src={user.photoUrl} alt={user.displayName ?? ""} />}
              <AvatarFallback className="bg-secondary text-sm font-bold text-gold sm:text-base">
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* online status dot */}
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          </span>

          <div className="min-w-0">
            <p dir="auto" className="truncate text-base font-extrabold leading-tight text-foreground sm:text-lg">
              {user?.displayName ?? t("home.welcome")}
            </p>
            {handle && (
              <p dir="ltr" className="truncate text-xs text-muted-foreground/90">
                @{handle}
              </p>
            )}
            {user ? (
              <Link href="/rewards" className="active:scale-press mt-1.5 inline-flex">
                <MembershipBadge tier={user.membership.tier} size="sm" />
              </Link>
            ) : null}
          </div>
        </div>

        {/* Balance cluster */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <Link
            href="/wallet"
            aria-label={t("nav.wallet")}
            className="active:scale-press group flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/[0.06] py-1.5 pl-2 pr-2.5 transition-colors hover:border-primary/40 hover:bg-primary/10 sm:gap-3 sm:pl-2.5 sm:pr-3.5"
          >
            <span className="bg-gold flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-[var(--shadow-gold)] ring-1 ring-primary/40 transition-transform group-hover:scale-105 sm:h-11 sm:w-11">
              <Wallet className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-col items-start">
              <span className="text-[11px] leading-none text-muted-foreground">{t("home.balance")}</span>
              <span className="mt-1 flex items-baseline gap-1">
                <span className="text-gold tabular-nums truncate text-lg font-extrabold leading-none tracking-tight sm:text-xl">
                  {priceValue(user?.balances?.availableBalance ?? 0)}
                </span>
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{currency}</span>
              </span>
            </span>
          </Link>

          {/* Live-activity shortcut */}
          <Link
            href="/reports"
            aria-label={t("menu.reports")}
            className="active:scale-press relative hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/[0.06] text-primary transition-colors hover:border-primary/40 hover:bg-primary/10 sm:flex"
          >
            <Activity className="h-5 w-5" strokeWidth={2} />
            <span className="animate-twinkle absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          </Link>
        </div>
      </div>
    </PremiumHeroCard>
  )
}
