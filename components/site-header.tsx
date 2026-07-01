"use client"

import Link from "next/link"
import { Wallet } from "lucide-react"
import { Logo } from "@/components/logo"
import { ProfileMenu } from "@/components/profile-menu"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"

/**
 * Deliberately minimal Telegram Mini App header: brand, wallet balance, and
 * the account avatar. Secondary utilities (notifications, sound, language,
 * admin) live inside the profile bottom sheet so the header stays calm and
 * never competes for attention.
 */
export function SiteHeader() {
  const { user } = useSession()
  const { priceCompact, t } = useI18n()
  const balance = priceCompact(user?.balances?.availableBalance ?? 0)

  return (
    <header className="glass sticky top-0 z-40 pt-safe">
      <div
        className="mx-auto flex h-16 w-full max-w-xl items-center justify-between gap-3"
        style={{
          // Base 20px gutter PLUS any device safe-area inset, so the header
          // never hugs the screen edges on phones without a side notch.
          paddingLeft: "calc(max(env(safe-area-inset-left), var(--tg-safe-left, 0px)) + 1.25rem)",
          paddingRight: "calc(max(env(safe-area-inset-right), var(--tg-safe-right, 0px)) + 1.25rem)",
        }}
      >
        {/* Brand */}
        <Link
          href="/"
          aria-label="SubIO"
          className="active:scale-press flex shrink-0 items-center transition-transform"
        >
          <Logo />
        </Link>

        {/* Account cluster — every control shares the same 36px height so the
            wallet pill and the avatar sit on one perfectly aligned baseline. */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/wallet"
            aria-label={t("nav.wallet")}
            className="active:scale-press group flex h-9 min-w-0 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 pl-3 pr-2.5 transition-all hover:border-primary/55 hover:bg-primary/15"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform group-hover:scale-105">
              <Wallet className="h-3.5 w-3.5" />
            </span>
            <span className="flex min-w-0 items-baseline gap-1">
              <span className="text-gold tabular-nums truncate text-sm font-extrabold leading-none">
                {balance.value}
              </span>
              {balance.suffix && (
                <span className="shrink-0 text-[11px] font-medium leading-none text-muted-foreground">
                  {balance.suffix}
                </span>
              )}
            </span>
          </Link>
          <ProfileMenu />
        </div>
      </div>
      {/* Luxe gold hairline instead of a flat border. */}
      <div className="hairline-gold" />
    </header>
  )
}
