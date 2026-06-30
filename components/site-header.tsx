"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { Logo } from "@/components/logo"
import { ProfileMenu } from "@/components/profile-menu"
import { WalletButton } from "@/components/header/wallet-button"
import { HeaderLanguage } from "@/components/header/header-language"
import { NotificationBell } from "@/components/header/notification-bell"
import { cn } from "@/lib/utils"

/**
 * The SubIO Telegram Mini App header — a premium, glassmorphic, sticky bar.
 *
 * Three balanced zones share one perfectly aligned baseline:
 *  - start  → the profile chip (avatar + tier), which opens the account sheet,
 *  - center → the animated 3D brand lockup (absolutely centred so it never
 *             shifts as the side clusters change width),
 *  - end    → the control cluster (wallet · language · notifications).
 *
 * It aligns to the exact same container + padding (`max-w-xl`, `px-4`,
 * `px-safe`) as the page content below, supports the iOS/Android/Telegram safe
 * areas, and intensifies its blur + shadow on scroll without any layout shift.
 * All motion runs through the project's `motion` system + global motion tiers,
 * so it degrades gracefully under reduced motion.
 */
export function SiteHeader() {
  const reduce = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <motion.header
      initial={reduce ? false : { y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 28 }}
      className="sticky top-0 z-40 pt-safe"
    >
      {/* Glass surface — depth + soft gold edge that deepens as you scroll. */}
      <div
        className={cn(
          "relative border-b backdrop-blur-xl backdrop-saturate-150",
          "transition-[background-color,border-color,box-shadow,backdrop-filter] duration-[var(--duration-base)] ease-[var(--ease-out-quint)]",
          scrolled
            ? "border-primary/15 bg-card/85 shadow-[var(--shadow-md)] backdrop-blur-2xl"
            : "border-border/50 bg-card/55",
        )}
      >
        {/* Subtle top-lit gradient for premium depth. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] to-transparent" />

        <div className="relative mx-auto flex h-16 w-full max-w-xl items-center justify-between gap-2 px-4 px-safe">
          {/* Start — account */}
          <ProfileMenu />

          {/* Center — brand (absolutely centred; press-scale lives on the inner
              link so it never fights the centering transform). */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Link
              href="/"
              aria-label="SubIO"
              className="active:scale-press pointer-events-auto inline-flex transition-transform"
            >
              <Logo animated size="md" />
            </Link>
          </div>

          {/* End — controls */}
          <div className="flex shrink-0 items-center gap-1.5">
            <WalletButton />
            <HeaderLanguage />
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Luxe gold hairline accent (brightens on scroll). */}
      <div
        className={cn(
          "hairline-gold transition-opacity duration-[var(--duration-base)]",
          scrolled ? "opacity-100" : "opacity-50",
        )}
      />
    </motion.header>
  )
}
