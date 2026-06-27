"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Bug, Check, RotateCcw, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { apiPost } from "@/lib/api-client"
import { useOpsData } from "../use-ops-data"

type ErrorEvent = {
  id: string
  level: string
  source: string
  name: string
  message: string
  stack?: string | null
  count: number
  resolved: boolean
  firstSeenAt: string
  lastSeenAt: string
}
type ErrorsResp = {
  events: ErrorEvent[]
  bySource: { source: string; count: number }[]
  totalUnresolved: number
}

const SOURCE_LABELS: Record<string, string> = {
  WEB: "وب‌سایت",
  MINIAPP: "مینی‌اپ",
  BOT: "ربات",
  API: "API",
  SERVER_ACTION: "Server Action",
  WORKER: "ورکر",
  CRON: "Cron",
  QUEUE: "صف",
  WEBHOOK: "وبهوک",
}

export function ErrorsTab() {
  const [showResolved, setShowResolved] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const key = `/api/v1/admin/ops/errors?resolved=${showResolved ? "1" : "0"}&limit=100`
  const { data, isLoading, mutate } = useOpsData<ErrorsResp>(key, {
    on: ["error"],
    refreshInterval: 20000,
  })

  async function act(id: string, action: "resolve" | "unresolve") {
    setBusy(id)
    try {
      await apiPost("/api/v1/admin/ops/errors", { id, action })
      toast.success(action === "resolve" ? "خطا به‌عنوان حل‌شده علامت خورد" : "خطا بازگشایی شد")
      void mutate()
    } catch {
      toast.error("عملیات ناموفق بود")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Source breakdown */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(data?.bySource ?? []).slice(0, 4).map((s) => (
          <div key={s.source} className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
            <p className="text-xs text-muted-foreground">{SOURCE_LABELS[s.source] ?? s.source}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-destructive">{s.count}</p>
          </div>
        ))}
        {(!data || data.bySource.length === 0) && !isLoading ? (
          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground backdrop-blur-sm">
            خطای حل‌نشده‌ای وجود ندارد.
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Bug className="size-4 text-primary" />
          {showResolved ? "خطاهای حل‌شده" : "خطاهای فعال"}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? "نمایش فعال‌ها" : "نمایش حل‌شده‌ها"}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (data?.events.length ?? 0) === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/70 text-sm text-muted-foreground">
            موردی برای نمایش وجود ندارد.
          </div>
        ) : (
          data?.events.map((e) => (
            <div
              key={e.id}
              className={cn(
                "rounded-xl border bg-card/80 p-4 backdrop-blur-sm",
                e.resolved ? "border-border/60 opacity-70" : "border-destructive/30",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {SOURCE_LABELS[e.source] ?? e.source}
                    </Badge>
                    <Badge
                      variant={e.level === "fatal" || e.level === "error" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {e.level}
                    </Badge>
                    <span className="font-semibold">{e.name}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold tabular-nums">
                      ×{e.count}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{e.message}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button
                    size="sm"
                    variant={e.resolved ? "outline" : "default"}
                    disabled={busy === e.id}
                    onClick={() => act(e.id, e.resolved ? "unresolve" : "resolve")}
                  >
                    {e.resolved ? (
                      <RotateCcw data-icon="inline-start" />
                    ) : (
                      <Check data-icon="inline-start" />
                    )}
                    {e.resolved ? "بازگشایی" : "حل شد"}
                  </Button>
                  {e.stack ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => setExpanded((id) => (id === e.id ? null : e.id))}
                    >
                      جزئیات
                      <ChevronDown className={cn("size-3 transition-transform", expanded === e.id && "rotate-180")} />
                    </button>
                  ) : null}
                </div>
              </div>
              {expanded === e.id && e.stack ? (
                <pre dir="ltr" className="mt-3 max-h-48 overflow-auto rounded-lg bg-secondary/60 p-3 text-left text-[11px] leading-relaxed text-muted-foreground">
                  {e.stack}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
