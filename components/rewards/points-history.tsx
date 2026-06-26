"use client"

import { ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { formatNumber, formatRelative } from "@/lib/format"

export type PointEntry = {
  id: string
  delta: number
  balanceAfter: number
  reason: string
  note: string | null
  createdAt: string
}

const REASON_LABELS: Record<string, string> = {
  PURCHASE: "خرید",
  REFERRAL: "دعوت دوستان",
  GIVEAWAY_ENTRY: "شرکت در قرعه‌کشی",
  DAILY_LOGIN: "ورود روزانه",
  PROFILE_COMPLETE: "تکمیل پروفایل",
  MISSION_REWARD: "پاداش مأموریت",
  ACHIEVEMENT: "دستاورد",
  ADMIN_ADJUSTMENT: "تعدیل مدیریت",
  REDEEM: "استفاده از امتیاز",
}

export function PointsHistory({ entries }: { entries: PointEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">هنوز امتیازی ثبت نشده است</p>
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
                {entry.note ?? REASON_LABELS[entry.reason] ?? entry.reason}
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
