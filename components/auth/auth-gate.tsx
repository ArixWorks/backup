"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useSession } from "@/hooks/use-session"
import { useTelegramAuth } from "@/components/telegram-provider"

/**
 * Client-side login gate. Renders children only for authenticated users; sends
 * everyone else to /login. The Telegram Mini App provider performs an automatic
 * initData login on first load, so real Telegram users won't see the gate.
 *
 * Crucially, while that auto-login is still detecting Telegram or verifying
 * initData we show the loader instead of redirecting — otherwise a brand-new
 * Telegram account (whose session/cookie doesn't exist yet) would be bounced to
 * /login before the account is even created.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession()
  const { phase } = useTelegramAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Telegram auto-login still settling: detecting/verifying, or it just
  // succeeded and the session cache is about to populate the user. While this
  // is true we never redirect — we wait for the user to appear.
  const telegramSettling =
    phase === "detecting" || phase === "authenticating" || phase === "authenticated"

  useEffect(() => {
    if (!isLoading && !user && !telegramSettling) {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""
      router.replace(`/login${next}`)
    }
  }, [isLoading, user, telegramSettling, pathname, router])

  // Authenticated user → show the app. Otherwise show the loader: this covers
  // the initial session fetch, the in-flight Telegram login, and the brief
  // moment before a redirect to /login navigates away.
  if (user) return <>{children}</>

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}
