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
        <Toaster position="top-center" richColors theme="dark" />
      </MotionProvider>
    </I18nProvider>
  )
}
