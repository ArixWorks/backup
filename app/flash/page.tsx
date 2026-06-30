"use client"

import { Zap } from "lucide-react"
import { FlashBrowser } from "@/components/flash-browser"
import { PageHeader } from "@/components/page-header"
import { useI18n } from "@/components/i18n-provider"

export default function FlashPage() {
  const { t } = useI18n()

  return (
    <div className="space-y-5">
      <PageHeader icon={Zap} title={t("flash.title")} description={t("flash.subtitle")} />

      <FlashBrowser />
    </div>
  )
}
