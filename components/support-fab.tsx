"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { Headphones } from "lucide-react"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"

/**
 * Always-available customer-support entry point. A thumb-reachable floating
 * action button that sits just above the bottom navigation (clear of the
 * Telegram safe area) and links straight to the ticket/support center.
 * Hidden on the support pages themselves to avoid redundancy.
 */
export function SupportFab() {
  const pathname = usePathname()
  const { user } = useSession()
  const { t } = useI18n()

  if (!user) return null
  if (pathname?.startsWith("/support")) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-4 z-40"
        style={{
          bottom: "calc(6rem + max(env(safe-area-inset-bottom), var(--tg-safe-bottom, 0px)))",
        }}
      >
        <Link
          href="/support"
          aria-label={t("a11y.supportOnline")}
          className="active:scale-press elevate-gold bg-gold group relative flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground ring-1 ring-primary/50 transition-transform hover:scale-105"
        >
          {/* soft pulsing halo */}
          <span className="absolute inset-0 -z-[1] animate-ping rounded-full bg-primary/30 [animation-duration:2.4s]" />
          <Headphones className="h-6 w-6" strokeWidth={2.2} />
        </Link>
      </motion.div>
    </AnimatePresence>
  )
}
