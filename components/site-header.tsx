"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Wallet } from "lucide-react"
import { Logo } from "@/components/logo"
import { ProfileMenu } from "@/components/profile-menu"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"

/**
 * Premium Telegram Mini App header. A scroll-aware frosted-glass bar that
 * deepens its blur, opacity and shadow as the page scrolls — without ever
 * shifting layout. Hosts the SubIO brand lockup, the wallet balance pill and
 * the account avatar. Secondary utilities (notifications, sound, language,
 * admin) live inside the profile bottom sheet so the header stays calm.
 *
 * Alignment contract: matches the app shell content container exactly
 * (`max-w-xl px-4`) plus full Telegram / device safe-area insets, so the brand
 * and account cluster never touch the screen edge on any device.
 */
export function SiteHeader() {
  const { user } = useSession()
  const { priceCompact, t } = useI18n()
  const balance = priceCompact(user?.balances?.availableBalance ?? 0)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header className="animate-in fade-in slide-in-from-top-2 sticky top-0 z-40 pt-safe duration-500">
      {/* Layered glass surface — blur / opacity / shadow intensify on scroll. */}
      <div
        className="relative"
        style={{
          backgroundColor: `color-mix(in oklch, var(--card) ${scrolled ? 80 : 60}%, transparent)`,
          backdropFilter: `blur(${scrolled ? 24 : 14}px) saturate(160%)`,
          WebkitBackdropFilter: `blur(${scrolled ? 24 : 14}px) saturate(160%)`,
          boxShadow: scrolled
            ? "var(--shadow-md), var(--inset-highlight)"
            : "var(--inset-highlight)",
          transition:
            "background-color var(--duration-base) var(--ease-out-quint), backdrop-filter var(--duration-base) var(--ease-out-quint), box-shadow var(--duration-base) var(--ease-out-quint)",
        }}
      >
        {/* Soft gold top-sheen for depth (decorative). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            backgroundImage:
              "linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 35%, transparent) 50%, transparent)",
          }}
        />

        <div className="mx-auto flex h-16 w-full max-w-xl items-center justify-between gap-3 px-4 px-safe">
          {/* Brand */}
          <Link
            href="/"
            aria-label="SubIO"
            className="active:scale-press flex shrink-0 items-center rounded-2xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Logo />
          </Link>

          {/* Account cluster — every control shares the same 36px height so the
              wallet pill and the avatar sit on one perfectly aligned baseline. */}
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/wallet"
              aria-label={t("nav.wallet")}
              className="active:scale-press group flex h-9 min-w-0 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 pl-3 pr-2.5 transition-all duration-[var(--duration-fast)] hover:border-primary/55 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-transform duration-[var(--duration-fast)] group-hover:scale-105">
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
      </div>
    </header>
  )
}
