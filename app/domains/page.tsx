"use client"

import { Globe } from "lucide-react"
import { ComingSoon } from "@/components/coming-soon"
import { useI18n } from "@/components/i18n-provider"

export default function DomainsPage() {
  const { t } = useI18n()
  return <ComingSoon icon={Globe} title={t("domains.title")} subtitle={t("domains.subtitle")} />
}
