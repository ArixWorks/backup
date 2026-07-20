"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Headphones, MessageCircleMore } from "lucide-react"
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
  const { t, dir } = useI18n()
  const reducedMotion = useReducedMotion()

  if (!user) return null
  if (pathname?.startsWith("/support")) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.78, y: 12, rotate: dir === "rtl" ? -8 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.82, y: 8 }}
        transition={{ type: "spring", stiffness: 380, damping: 24, mass: 0.75 }}
        className="fixed end-4 bottom-[calc(6rem+max(env(safe-area-inset-bottom),var(--tg-safe-bottom,0px)))] z-40 lg:bottom-6 lg:end-5"
        style={{ perspective: "600px" }}
        dir={dir}
      >
        <motion.div
          whileHover={reducedMotion ? undefined : { y: -3, rotateX: 7, scale: 1.04 }}
          whileTap={reducedMotion ? { scale: 0.96 } : { y: 3, rotateX: -14, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 520, damping: 20 }}
          className="relative"
          style={{ transformStyle: "preserve-3d" }}
        >
          <Link
            href="/support"
            aria-label={t("a11y.supportOnline")}
            className="group relative flex h-14 min-w-14 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-primary/45 bg-primary px-4 text-primary-foreground shadow-[0_9px_0_color-mix(in_oklab,var(--primary),black_35%),0_16px_30px_-12px_var(--primary)] outline-none transition-[border-color,box-shadow] hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:h-12 lg:min-w-12 lg:rounded-xl lg:px-3"
          >
            <span aria-hidden="true" className="absolute inset-x-2 top-1 h-px bg-primary-foreground/45" />
            <Headphones className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:-rotate-6" strokeWidth={2.3} />
            <MessageCircleMore className="h-4 w-4 shrink-0 opacity-80 lg:hidden" aria-hidden="true" />
            <span className="sr-only">{t("a11y.supportOnline")}</span>
          </Link>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
