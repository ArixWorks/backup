"use client"

import { Toaster } from "@/components/ui/sonner"
import { TelegramProvider } from "@/components/telegram-provider"
import { I18nProvider } from "@/components/i18n-provider"
import { MotionProvider } from "@/components/motion-provider"
import { ReferralCapture } from "@/components/referral-capture"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <MotionProvider>
        <TelegramProvider>
          <ReferralCapture />
          {children}
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
  )
}
