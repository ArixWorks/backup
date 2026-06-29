"use client"

import { ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { formatNumber, formatRelative } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

export type PointEntry = {
  id: string
  delta: number
  balanceAfter: number
  reason: string
  note: string | null
  createdAt: string
}

const REASON_KEYS: Record<string, MessageKey> = {
  PURCHASE: "ptSrc.PURCHASE",
  REFERRAL: "ptSrc.REFERRAL",
  GIVEAWAY_ENTRY: "ptSrc.GIVEAWAY_ENTRY",
  DAILY_LOGIN: "ptSrc.DAILY_LOGIN",
  PROFILE_COMPLETE: "ptSrc.PROFILE_COMPLETE",
  MISSION_REWARD: "ptSrc.MISSION_REWARD",
  ACHIEVEMENT: "ptSrc.ACHIEVEMENT",
  ADMIN_ADJUSTMENT: "ptSrc.ADMIN_ADJUSTMENT",
  REDEEM: "ptSrc.REDEEM",
}

export function PointsHistory({ entries }: { entries: PointEntry[] }) {
  const { t } = useI18n()
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("points.empty")}</p>
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => {
        const positive = entry.delta >= 0
        return (
          <li key={entry.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                positive ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
              }`}
            >
              {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {entry.note ?? (REASON_KEYS[entry.reason] ? t(REASON_KEYS[entry.reason]) : entry.reason)}
              </p>
              <p className="text-xs text-muted-foreground">{formatRelative(entry.createdAt)}</p>
            </div>
            <span className={`shrink-0 text-sm font-bold ${positive ? "text-primary" : "text-destructive"}`}>
              {positive ? "+" : ""}
              {formatNumber(entry.delta)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
