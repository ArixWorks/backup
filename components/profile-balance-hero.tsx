"use client"

import Link from "next/link"
import { Activity, Wallet } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { MembershipBadge } from "@/components/membership-badge"

/**
 * The dashboard signature surface: a single compact, horizontal "wallet card"
 * that fuses the user's identity (avatar · name · @handle · membership tier)
 * on one end with their wallet balance + a live-activity shortcut on the other.
 *
 * Visual language is 100% gold-theme driven (see globals.css utilities):
 *  - `gold-border`  → animated gradient hairline frame
 *  - `surface-glow` → soft radial gold light from the top corner
 *  - `sheen`        → slow diagonal light sweep
 *  - floating gold blooms + twinkling gold dust for depth
 * All ambient motion is decoration-only and auto-tuned by the app's motion
 * tiers / OS Reduce-Motion, so low-end devices stay perfectly responsive.
 */
export function ProfileBalanceHero() {
  const { user } = useSession()
  const { t, priceValue, currency } = useI18n()

  const initials = (user?.displayName ?? "?").slice(0, 2)
  const handle = user?.telegramUsername ?? user?.alias ?? null

  return (
    <section
      aria-label={t("home.welcome")}
      className="gold-border sheen surface-glow relative overflow-hidden px-4 py-3.5 shadow-xl shadow-primary/10 sm:px-5 sm:py-4"
    >
      {/* ── Ambient gold background: blooms · dust · wave ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <span className="animate-float absolute -right-10 -top-12 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />
        <span
          className="animate-float absolute -bottom-14 -left-8 h-36 w-36 rounded-full bg-primary/10 blur-3xl"
          style={{ animationDelay: "1.4s" }}
        />
        {/* twinkling gold dust */}
        <span className="animate-twinkle absolute left-[22%] top-3 h-1 w-1 rounded-full bg-primary/70" />
        <span
          className="animate-twinkle absolute left-[58%] top-6 h-0.5 w-0.5 rounded-full bg-primary/60"
          style={{ animationDelay: "0.8s" }}
        />
        <span
          className="animate-twinkle absolute right-[18%] bottom-4 h-1 w-1 rounded-full bg-primary/60"
          style={{ animationDelay: "1.9s" }}
        />
        {/* soft gold wave lines along the base */}
        <svg
          className="absolute inset-x-0 bottom-0 h-16 w-full opacity-60"
          viewBox="0 0 400 64"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 40 C 80 12, 160 60, 240 34 S 400 20, 400 44 L400 64 L0 64 Z"
            fill="url(#hero-wave)"
          />
          <path
            d="M0 46 C 90 24, 170 62, 250 42 S 400 34, 400 52"
            stroke="url(#hero-wave-line)"
            strokeWidth="1"
            fill="none"
          />
          <defs>
            <linearGradient id="hero-wave" x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--primary)" stopOpacity="0" />
              <stop offset="0.5" stopColor="var(--primary)" stopOpacity="0.12" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hero-wave-line" x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--primary)" stopOpacity="0" />
              <stop offset="0.5" stopColor="var(--primary)" stopOpacity="0.55" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ── Content row ── */}
      <div className="relative z-[2] flex items-center justify-between gap-3">
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
    </section>
  )
}
