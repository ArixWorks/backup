"use client"

import Link from "next/link"
import { Activity, BadgePercent, Wallet } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { MembershipBadge } from "@/components/membership-badge"
import { PremiumHeroCard } from "@/components/premium-hero-card"

export function ProfileBalanceHero() {
  const { user } = useSession()
  const { t, priceValue, currency } = useI18n()
  const reduceMotion = useReducedMotion()
  const initials = (user?.displayName ?? "?").slice(0, 2)
  const handle = user?.telegramUsername ?? user?.alias ?? null
  const discount = user?.membership?.discountPercent ?? 0

  return (
    <PremiumHeroCard aria-label={t("home.welcome")} deviceTilt ambient={false} className="!p-0">
      <div className="profile-network relative overflow-hidden rounded-[inherit] px-3.5 py-3.5 sm:px-5 sm:py-4">
        <div aria-hidden className="profile-network__beam" />
        <div className="relative z-10 flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <motion.span
              className="relative shrink-0"
              animate={reduceMotion ? undefined : { y: [0, -2, 0] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <span aria-hidden className="absolute -inset-1 rounded-full bg-primary/25 blur-md" />
              <span aria-hidden className="absolute -inset-0.5 rounded-full border border-primary/60 shadow-[0_0_18px_color-mix(in_oklab,var(--primary)_38%,transparent)]" />
              <Avatar className="relative size-12 border-2 border-background sm:size-14">
                {user?.photoUrl ? <AvatarImage src={user.photoUrl} alt={user.displayName ?? ""} /> : null}
                <AvatarFallback className="bg-secondary text-sm font-bold text-primary sm:text-base">{initials}</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 end-0 size-3.5 rounded-full border-2 border-background bg-success shadow-[0_0_8px_color-mix(in_oklab,var(--success)_80%,transparent)]" />
            </motion.span>

            <div className="min-w-0">
              <p dir="auto" className="truncate text-sm font-extrabold leading-5 text-foreground sm:text-lg">
                {user?.displayName ?? t("home.welcome")}
              </p>
              {handle ? <p dir="ltr" className="truncate text-[11px] leading-4 text-muted-foreground sm:text-xs">@{handle}</p> : null}
              {user ? <Link href="/rewards" className="mt-1 inline-flex"><MembershipBadge tier={user.membership.tier} size="sm" /></Link> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/wallet"
              aria-label={t("nav.wallet")}
              className="profile-balance group relative flex min-h-14 min-w-0 items-center gap-2 overflow-hidden rounded-2xl border border-primary/25 px-2 py-1.5 transition-[border-color,transform] duration-300 hoverable:hover:-translate-y-0.5 hoverable:hover:border-primary/55 sm:min-w-48 sm:gap-3 sm:px-3"
            >
              <span aria-hidden className="profile-balance__scan" />
              <motion.span
                className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary text-primary-foreground shadow-[var(--shadow-accent)] sm:size-10"
                whileHover={reduceMotion ? undefined : { rotate: -6, scale: 1.06 }}
              >
                <Wallet className="size-4.5 sm:size-5" strokeWidth={2.2} />
              </motion.span>
              <span className="relative flex min-w-0 flex-col items-start">
                <span className="hidden text-[10px] leading-none text-muted-foreground min-[350px]:block">{t("home.balance")}</span>
                <span className="mt-0.5 flex items-baseline gap-1">
                  <span className="text-gold max-w-24 truncate text-base font-black leading-none tabular-nums sm:max-w-none sm:text-xl">{priceValue(user?.balances?.availableBalance ?? 0)}</span>
                  <span className="text-[9px] font-semibold text-muted-foreground sm:text-[11px]">{currency}</span>
                </span>
                {discount > 0 ? (
                  <span className="mt-1 flex items-center gap-1 text-[9px] font-bold text-primary sm:text-[10px]">
                    <BadgePercent className="size-3" />
                    {t("membership.discount").replace("{n}", String(discount))}
                  </span>
                ) : null}
              </span>
            </Link>

            <Link href="/reports" aria-label={t("menu.reports")} className="hidden size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.08] text-primary transition-colors hoverable:hover:border-primary/55 hoverable:hover:bg-primary/15 sm:flex">
              <Activity className="size-5" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </PremiumHeroCard>
  )
}
