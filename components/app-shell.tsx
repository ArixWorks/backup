"use client"

import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { SiteHeader } from "@/components/site-header"
import { BottomNav } from "@/components/bottom-nav"
import { SupportFab } from "@/components/support-fab"
import { NotificationWatcher } from "@/components/notification-watcher"
import { AuthGate } from "@/components/auth/auth-gate"
import { MaintenanceGate } from "@/components/maintenance-gate"
import { ForcePasswordChange } from "@/components/auth/force-password-change"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { ChannelGate } from "@/components/channel-gate"
import { ScrollProgress } from "@/components/motion"

/**
 * Standalone authentication / account-recovery routes. These render bare
 * (no storefront chrome, no AuthGate) because they're either for signed-out
 * users (login, forgot/reset password) or opened from an email link in a
 * fresh browser (email verification). They own their full-screen layout via
 * AuthShell.
 */
const BARE_ROUTES = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/account/verify-email",
])

/**
 * Renders the storefront chrome (compact header + bottom tab bar) for the
 * Telegram Mini App experience. Auth/recovery routes render bare (no chrome,
 * no gate); admin routes bring their own AdminShell and handle their own auth.
 * Everything else sits behind the AuthGate so only the signed-in user's own
 * data is ever shown.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith("/admin")
  const isBare = pathname ? BARE_ROUTES.has(pathname) : false

  if (isBare) return <>{children}</>
  if (isAdmin) return <>{children}</>

  return (
    <AuthGate>
      <MaintenanceGate>
        <ScrollProgress />
        <NotificationWatcher />
        <ForcePasswordChange />
        <OnboardingFlow />
        <ChannelGate />
        <SiteHeader />
        {/* Bottom padding must clear the fixed tab bar *plus* the bottom safe
            inset. Crucially this mirrors the nav's own padding by using
            max(env, --tg-safe-bottom): inside Telegram the CSS env() is often 0
            while the real inset lives in --tg-safe-bottom, so relying on env()
            alone let trailing content slide under the nav on real phones. */}
        <main className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-xl px-4 pt-4 pb-[calc(6.5rem+max(env(safe-area-inset-bottom),var(--tg-safe-bottom,0px)))]">
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
      </MaintenanceGate>
    </AuthGate>
  )
}
