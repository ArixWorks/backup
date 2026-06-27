"use client"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { STATUS_META } from "@/lib/monitoring/format"

export type ServiceHealth = {
  service: string
  status: string
  latencyMs?: number | null
  message?: string | null
  checkedAt?: string
}

const SERVICE_LABELS: Record<string, string> = {
  postgres: "PostgreSQL",
  redis: "Redis",
  bot: "ربات تلگرام",
  webhook: "وبهوک تلگرام",
  email: "سرویس ایمیل",
  web: "وب‌سایت",
  miniapp: "مینی‌اپ",
  cron: "زمان‌بند (Cron)",
  monitor: "جمع‌آورنده متریک",
  queue: "صف پردازش",
  worker: "ورکر پس‌زمینه",
  ws: "سرور WebSocket",
  payment: "درگاه پرداخت",
}

function label(service: string) {
  return SERVICE_LABELS[service] ?? service
}

/** Grid of service health cards with status dot, latency and message. */
export function HealthGrid({
  services,
  loading,
}: {
  services?: ServiceHealth[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!services || services.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/70 text-sm text-muted-foreground">
        هنوز داده‌ی سلامتی ثبت نشده است. جمع‌آورنده را اجرا کنید.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => {
        const meta = STATUS_META[s.status] ?? STATUS_META.UNKNOWN
        return (
          <div
            key={s.service}
            className={cn(
              "flex items-center justify-between rounded-xl border bg-card/80 p-4 backdrop-blur-sm",
              s.status === "DOWN" ? "border-destructive/40" : "border-border/70",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  {s.status === "UP" && (
                    <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", meta.dot)} />
                  )}
                  <span className={cn("relative inline-flex size-2.5 rounded-full", meta.dot)} />
                </span>
                <span className="truncate font-semibold">{label(s.service)}</span>
              </div>
              {s.message ? (
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{s.message}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-left">
              <span className={cn("text-xs font-bold", meta.text)}>{meta.label}</span>
              {s.latencyMs != null ? (
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(s.latencyMs)} ms
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
