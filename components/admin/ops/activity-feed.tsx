"use client"

import {
  ShoppingCart,
  Wallet,
  Gavel,
  Gift,
  Bell,
  TriangleAlert,
  CircleCheck,
  Bug,
  Activity as ActivityIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useOpsRealtime, type OpsEvent } from "./ops-realtime"

function iconFor(evt: OpsEvent) {
  if (evt.kind === "alert") return { Icon: TriangleAlert, cls: "text-destructive" }
  if (evt.kind === "alert_resolved") return { Icon: CircleCheck, cls: "text-chart-2" }
  if (evt.kind === "error") return { Icon: Bug, cls: "text-destructive" }
  const type = String(evt.payload?.type ?? "")
  if (type.includes("order")) return { Icon: ShoppingCart, cls: "text-chart-2" }
  if (type.includes("wallet") || type.includes("deposit")) return { Icon: Wallet, cls: "text-chart-3" }
  if (type.includes("auction") || type.includes("bid")) return { Icon: Gavel, cls: "text-chart-1" }
  if (type.includes("giveaway")) return { Icon: Gift, cls: "text-chart-3" }
  if (type.includes("notif")) return { Icon: Bell, cls: "text-muted-foreground" }
  return { Icon: ActivityIcon, cls: "text-muted-foreground" }
}

function timeAgo(at: string): string {
  const diff = Date.now() - new Date(at).getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return "همین حالا"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} دقیقه پیش`
  const h = Math.round(m / 60)
  return `${h} ساعت پیش`
}

/** Realtime activity stream — orders, transactions, alerts, errors, etc. */
export function ActivityFeed({ className }: { className?: string }) {
  const { feed } = useOpsRealtime()

  return (
    <div className={cn("flex flex-col", className)}>
      {feed.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          منتظر رویدادهای زنده…
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {feed.map((evt, i) => {
            const { Icon, cls } = iconFor(evt)
            const title = String(evt.payload?.title ?? evt.payload?.message ?? labelForKind(evt))
            return (
              <li
                key={`${evt.at}-${i}`}
                className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/60 animate-in fade-in slide-in-from-top-1"
              >
                <span className={cn("mt-0.5 shrink-0", cls)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{title}</p>
                  <p className="text-[11px] text-muted-foreground">{timeAgo(evt.at)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function labelForKind(evt: OpsEvent): string {
  switch (evt.kind) {
    case "alert":
      return "هشدار جدید"
    case "alert_resolved":
      return "هشدار برطرف شد"
    case "error":
      return "خطای جدید ثبت شد"
    default:
      return "رویداد"
  }
}
