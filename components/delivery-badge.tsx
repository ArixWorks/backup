"use client"

import { Zap, Hand } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

export function DeliveryBadge({ type, className }: { type: string; className?: string }) {
  const { t } = useI18n()
  // DeliveryType enum is MANUAL | AUTOMATIC; accept the legacy "AUTO_POOL" too.
  const auto = type === "AUTOMATIC" || type === "AUTO_POOL"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        auto ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {auto ? <Zap className="h-3 w-3" /> : <Hand className="h-3 w-3" />}
      {auto ? t("flash.autoDelivery") : t("flash.manualDelivery")}
    </span>
  )
}
