"use client"

import { UserPlus, UserCheck, ShoppingBag } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

export type ReferralItem = {
  name: string
  joinedAt: string
  stage: "pending" | "joined" | "purchased"
}

const STAGE_META: Record<
  ReferralItem["stage"],
  { labelKey: MessageKey; icon: typeof UserPlus; className: string }
> = {
  pending: { labelKey: "refAct.pending", icon: UserPlus, className: "text-muted-foreground" },
  joined: { labelKey: "refAct.joined", icon: UserCheck, className: "text-primary" },
  purchased: { labelKey: "refAct.purchased", icon: ShoppingBag, className: "text-emerald-500" },
}

export function ReferralActivity({ items }: { items: ReferralItem[] }) {
  const { t } = useI18n()

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const day = Math.floor(diff / 86400000)
    if (day > 0) return t("refAct.daysAgo", { count: day })
    const hour = Math.floor(diff / 3600000)
    if (hour > 0) return t("refAct.hoursAgo", { count: hour })
    const min = Math.floor(diff / 60000)
    return min > 0 ? t("refAct.minutesAgo", { count: min }) : t("refAct.now")
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("refAct.empty")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("refAct.emptyDesc")}
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => {
        const meta = STAGE_META[item.stage]
        const Icon = meta.icon
        return (
          <li
            key={i}
            className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-3 py-2.5"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-background ${meta.className}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
              <p className="text-[11px] text-muted-foreground">{timeAgo(item.joinedAt)}</p>
            </div>
            <span className={`shrink-0 text-xs font-bold ${meta.className}`}>{t(meta.labelKey)}</span>
          </li>
        )
      })}
    </ul>
  )
}
