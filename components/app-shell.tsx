"use client"

import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { SiteHeader } from "@/components/site-header"
import { BottomNav } from "@/components/bottom-nav"
import { SupportFab } from "@/components/support-fab"
import { NotificationWatcher } from "@/components/notification-watcher"
import { AuthGate } from "@/components/auth/auth-gate"
import { ForcePasswordChange } from "@/components/auth/force-password-change"

/**
 * Renders the storefront chrome (compact header + bottom tab bar) for the
 * Telegram Mini App experience. The login page renders bare (no chrome, no
 * gate); admin routes bring their own AdminShell and handle their own auth.
 * Everything else sits behind the AuthGate so only the signed-in user's own
 * data is ever shown.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith("/admin")
  const isLogin = pathname === "/login"

  if (isLogin) return <>{children}</>
  if (isAdmin) return <>{children}</>

  return (
    <AuthGate>
      <NotificationWatcher />
      <ForcePasswordChange />
      <SiteHeader />
      <main className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-xl px-4 pb-28 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <SupportFab />
      <BottomNav />
    </AuthGate>
  )
}
