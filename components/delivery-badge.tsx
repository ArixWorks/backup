"use client"

import { Bolt, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

/**
 * Compact, colored delivery indicator.
 * - Instant (AUTOMATIC / legacy AUTO_POOL): Bolt icon.
 * - Manual: Clock icon.
 * Both render in the success (green) accent to read as a positive attribute,
 * matching the approved product-detail meta row. Shared by the product/auction
 * detail pages and the flash/auction cards.
 */
export function DeliveryBadge({ type, className }: { type: string; className?: string }) {
  const { t } = useI18n()
  const auto = type === "AUTOMATIC" || type === "AUTO_POOL"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-lg bg-success/12 px-2 py-1 text-[10.5px] font-semibold leading-none text-success",
        className,
      )}
    >
      {auto ? <Bolt className="size-3" /> : <Clock className="size-3" />}
      {auto ? t("flash.autoDelivery") : t("flash.manualDelivery")}
    </span>
  )
}
