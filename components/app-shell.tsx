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
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { Sidebar } from "@/components/layout/sidebar"

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
        {/* Unified responsive frame. ONE DOM tree adapts by ENVIRONMENT via CSS
            `web:`/`tg:` variants (set on <html data-env> before hydration) — no
            JS layout swap, so there is no hydration mismatch and zero CLS. The
            Sidebar self-hides except in a browser at lg+, where BottomNav hides
            in turn, producing a real desktop marketplace dashboard while the
            Telegram mini-app keeps its compact mobile chrome untouched. */}
        <SidebarProvider>
          <div className="flex min-h-dvh w-full">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <SiteHeader />
              {/* Bottom padding clears the fixed tab bar *plus* the bottom safe
                  inset via max(env, --tg-safe-bottom) (env() is often 0 inside
                  Telegram while the real inset lives in --tg-safe-bottom). On
                  the web desktop shell the tab bar is gone, so we drop it. */}
              <main className="flex-1 px-4 pt-4 pb-[calc(6.5rem+max(env(safe-area-inset-bottom),var(--tg-safe-bottom,0px)))] web:lg:px-6 web:lg:pt-6 web:lg:pb-10">
                <div className="mx-auto w-full max-w-[var(--shell-max)] web:lg:max-w-[var(--content-max)]">
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
                </div>
              </main>
            </div>
          </div>
          <SupportFab />
          <BottomNav />
        </SidebarProvider>
      </MaintenanceGate>
    </AuthGate>
  )
}
