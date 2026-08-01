"use client"

import { useEffect } from "react"
import { SWRConfig } from "swr"
import { Toaster } from "@/components/ui/sonner"
import { TelegramProvider } from "@/components/telegram-provider"
import { I18nProvider } from "@/components/i18n-provider"
import { MotionProvider } from "@/components/motion-provider"
import { ReferralCapture } from "@/components/referral-capture"
import { BannedGate } from "@/components/auth/banned-gate"
import { fetcher } from "@/lib/api-client"
// Side effect: configures the global Persian Zod locale for client-side
// validation so form validation errors are in Persian too.
import "@/lib/zod"

// App-wide SWR defaults. In a Telegram WebView the app is constantly
// backgrounded/refocused, so aggressive focus revalidation causes redundant
// request storms. We dedupe identical keys within a short window and disable
// focus refetching while keeping reconnect revalidation for correctness.
const swrConfig = {
  fetcher,
  revalidateOnFocus: false,
  dedupingInterval: 5000,
  errorRetryCount: 2,
  keepPreviousData: true,
}

/**
 * Tells the /public boot watchdog that React actually executed and mounted, so
 * it stands down instead of showing the "app failed to load" fallback. Also
 * removes the fallback if it already appeared (e.g. React mounted just after
 * the grace window on a very slow device).
 */
function BootSignal() {
  useEffect(() => {
    window.__APP_MOUNTED__ = true
    document.getElementById("boot-fallback")?.remove()
  }, [])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={swrConfig}>
    <BootSignal />
    <I18nProvider>
      <MotionProvider>
        <TelegramProvider>
          <ReferralCapture />
          {children}
          <BannedGate />
        </TelegramProvider>
        <Toaster
          position="top-center"
          theme="dark"
          dir="auto"
          expand
          gap={12}
          offset={{ top: "calc(max(env(safe-area-inset-top), var(--tg-safe-top, 0px)) + 18px)" }}
          mobileOffset={{ top: "calc(max(env(safe-area-inset-top), var(--tg-safe-top, 0px)) + 14px)" }}
        />
        </MotionProvider>
    </I18nProvider>
    </SWRConfig>
  )
}
