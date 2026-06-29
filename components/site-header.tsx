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
      <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between gap-2 px-4 px-safe">
        <Link
          href="/"
          aria-label="بات سوبیو"
          className="active:scale-press shrink-0 transition-transform"
        >
          <Logo />
        </Link>

        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/wallet"
            aria-label={t("nav.wallet")}
            className="active:scale-press group flex min-w-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 shadow-[0_0_0_1px_rgba(0,0,0,0.15)] transition-all hover:border-primary/60 hover:bg-primary/15"
          >
            <Wallet className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:scale-110" />
            <span className="text-gold tabular-nums truncate text-sm font-extrabold leading-none">
              {balance.value}
            </span>
            {balance.suffix && (
              <span className="shrink-0 text-[11px] leading-none text-muted-foreground">
                {balance.suffix}
              </span>
            )}
          </Link>
          <div className="shrink-0">
            <ProfileMenu />
          </div>
        </div>
      </div>
      {/* Luxe gold hairline instead of a flat border. */}
      <div className="hairline-gold" />
    </header>
  )
}
