"use client"

import { Zap } from "lucide-react"
import { FlashBrowser } from "@/components/flash-browser"
import { useI18n } from "@/components/i18n-provider"

export default function FlashPage() {
  const { t } = useI18n()

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Zap className="h-5 w-5 text-primary" />
          {t("flash.title")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("flash.subtitle")}</p>
      </header>

      <FlashBrowser />
    </div>
  )
}
