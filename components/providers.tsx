"use client"

import { SWRConfig } from "swr"
import { Toaster } from "@/components/ui/sonner"
import { TelegramProvider } from "@/components/telegram-provider"
import { I18nProvider } from "@/components/i18n-provider"
import { MotionProvider } from "@/components/motion-provider"
import { MembershipThemeProvider } from "@/components/membership-theme-provider"
import { ReferralCapture } from "@/components/referral-capture"
import { fetcher } from "@/lib/api-client"

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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={swrConfig}>
    <I18nProvider>
      <MotionProvider>
        <TelegramProvider>
          <MembershipThemeProvider>
            <ReferralCapture />
            {children}
          </MembershipThemeProvider>
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
