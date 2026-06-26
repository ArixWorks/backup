"use client"

import { UserPlus, UserCheck, ShoppingBag } from "lucide-react"

export type ReferralItem = {
  name: string
  joinedAt: string
  stage: "pending" | "joined" | "purchased"
}

const STAGE_META: Record<
  ReferralItem["stage"],
  { label: string; icon: typeof UserPlus; className: string }
> = {
  pending: { label: "ثبت‌نام", icon: UserPlus, className: "text-muted-foreground" },
  joined: { label: "فعال", icon: UserCheck, className: "text-primary" },
  purchased: { label: "خرید کرد", icon: ShoppingBag, className: "text-emerald-500" },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const day = Math.floor(diff / 86400000)
  if (day > 0) return `${day} روز پیش`
  const hour = Math.floor(diff / 3600000)
  if (hour > 0) return `${hour} ساعت پیش`
  const min = Math.floor(diff / 60000)
  return min > 0 ? `${min} دقیقه پیش` : "همین حالا"
}

export function ReferralActivity({ items }: { items: ReferralItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
        <p className="text-sm text-muted-foreground">هنوز کسی را دعوت نکرده‌اید.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          لینک خود را به اشتراک بگذارید تا اینجا دوستانتان را ببینید.
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
            <span className={`shrink-0 text-xs font-bold ${meta.className}`}>{meta.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
