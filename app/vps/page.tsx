"use client"

import { Server } from "lucide-react"
import { ComingSoon } from "@/components/coming-soon"
import { useI18n } from "@/components/i18n-provider"

export default function VpsPage() {
  const { t } = useI18n()
  return <ComingSoon icon={Server} title={t("vps.title")} subtitle={t("vps.subtitle")} />
}
