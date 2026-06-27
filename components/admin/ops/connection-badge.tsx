"use client"

import { Radio, WifiOff, Loader2, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { useOpsRealtime } from "./ops-realtime"

const META = {
  ws: { label: "زنده (WebSocket)", icon: Radio, cls: "border-chart-2/30 bg-chart-2/10 text-chart-2" },
  sse: { label: "زنده (SSE)", icon: Activity, cls: "border-chart-2/30 bg-chart-2/10 text-chart-2" },
  polling: { label: "به‌روزرسانی دوره‌ای", icon: WifiOff, cls: "border-chart-1/30 bg-chart-1/10 text-chart-1" },
  connecting: { label: "در حال اتصال…", icon: Loader2, cls: "border-border bg-secondary text-muted-foreground" },
} as const

/** Small pill showing the active realtime transport with a live pulse. */
export function ConnectionBadge() {
  const { transport } = useOpsRealtime()
  const meta = META[transport]
  const Icon = meta.icon
  const live = transport === "ws" || transport === "sse"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        meta.cls,
      )}
    >
      <span className="relative flex size-2">
        {live && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-2 opacity-60" />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", live ? "bg-chart-2" : "bg-current")} />
      </span>
      <Icon className={cn("size-3", transport === "connecting" && "animate-spin")} />
      {meta.label}
    </span>
  )
}
