"use client"

import Link from "next/link"
import { Wallet } from "lucide-react"
import { Logo } from "@/components/logo"
import { ProfileMenu } from "@/components/profile-menu"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer"

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
        className="mx-auto flex h-16 w-full max-w-[var(--shell-max)] items-center justify-between gap-1.5 min-[360px]:gap-2 web:lg:h-[var(--header-h-web)] web:lg:max-w-[var(--content-max)] web:lg:gap-3"
        style={{
          // Narrow Telegram webviews need compact gutters, while wider phones
          // retain the original breathing room. Device safe areas are additive.
          paddingLeft:
            "calc(max(env(safe-area-inset-left), var(--tg-safe-left, 0px)) + clamp(0.5rem, 3.2vw, 1.25rem))",
          paddingRight:
            "calc(max(env(safe-area-inset-right), var(--tg-safe-right, 0px)) + clamp(0.5rem, 3.2vw, 1.25rem))",
        }}
      >
        {/* Brand + mobile menu. The hamburger opens the nav Drawer on phones and
            is hidden at lg+, where the persistent Sidebar owns navigation. */}
        <div className="flex min-w-0 shrink items-center gap-1 min-[360px]:gap-1.5">
          <MobileNavDrawer />
          <Link
            href="/"
            aria-label="SubIO"
            className="active:scale-press flex min-w-0 shrink items-center transition-transform web:lg:hidden"
          >
            <Logo compactOnNarrow />
          </Link>
        </div>

        {/* Account cluster remains fully visible down to 320px. The compact
            formatter keeps the amount readable while the pill owns a strict
            width budget instead of pushing the avatar beyond the viewport. */}
        <div className="flex min-w-0 shrink-0 items-center gap-1 min-[360px]:gap-2">
          <Link
            href="/wallet"
            aria-label={`${t("nav.wallet")}: ${balance.value}${balance.suffix ? ` ${balance.suffix}` : ""}`}
            title={`${balance.value}${balance.suffix ? ` ${balance.suffix}` : ""}`}
            className="active:scale-press group flex h-11 min-w-0 max-w-28 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 transition-all hover:border-primary/55 hover:bg-primary/15 min-[390px]:max-w-32 min-[390px]:gap-2 min-[390px]:px-2.5"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform group-hover:scale-105">
              <Wallet className="h-3.5 w-3.5" />
            </span>
            <span className="flex min-w-0 items-baseline gap-1 overflow-hidden whitespace-nowrap">
              <span className="text-gold min-w-0 truncate text-sm font-extrabold leading-none tabular-nums">
                {balance.value}
              </span>
              {balance.suffix && (
                <span className="shrink-0 text-[10px] font-medium leading-none text-muted-foreground min-[390px]:text-[11px]">
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
