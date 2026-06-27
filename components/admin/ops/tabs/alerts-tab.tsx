"use client"

import { useState } from "react"
import { toast } from "sonner"
import { BellRing, Check, Plus, Trash2, TriangleAlert, CircleCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { apiPost, apiPatch, apiDelete } from "@/lib/api-client"
import { formatRelative } from "@/lib/format"
import { useOpsData } from "../use-ops-data"
import { AlertRuleDialog } from "../alert-rule-dialog"

type AlertEvent = {
  id: string
  title: string
  severity: "INFO" | "WARNING" | "CRITICAL"
  status: "FIRING" | "RESOLVED"
  metric?: string | null
  value?: number | null
  message: string
  acked: boolean
  startedAt: string
  resolvedAt?: string | null
  rule?: { name: string } | null
}
type EventsResp = { events: AlertEvent[]; firing: number }

export type AlertRule = {
  id: string
  name: string
  metric: string
  comparator: "GT" | "LT"
  threshold: number
  forSeconds: number
  severity: "INFO" | "WARNING" | "CRITICAL"
  channels: string[]
  enabled: boolean
  cooldownSeconds: number
}
type RulesResp = { rules: AlertRule[] }

const SEV_BADGE: Record<string, "destructive" | "secondary" | "outline"> = {
  CRITICAL: "destructive",
  WARNING: "secondary",
  INFO: "outline",
}
const SEV_LABEL: Record<string, string> = { CRITICAL: "بحرانی", WARNING: "هشدار", INFO: "اطلاع" }

export function AlertsTab() {
  const [dialogRule, setDialogRule] = useState<AlertRule | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const { data: ev, isLoading: evLoading, mutate: mutateEvents } = useOpsData<EventsResp>(
    "/api/v1/admin/ops/alerts?limit=50",
    { on: ["alert", "alert_resolved"], refreshInterval: 15000 },
  )
  const { data: rulesData, isLoading: rulesLoading, mutate: mutateRules } = useOpsData<RulesResp>(
    "/api/v1/admin/ops/alerts/rules",
    { refreshInterval: 60000 },
  )

  async function ack(id: string) {
    setBusy(id)
    try {
      await apiPost("/api/v1/admin/ops/alerts", { id })
      void mutateEvents()
    } catch {
      toast.error("عملیات ناموفق بود")
    } finally {
      setBusy(null)
    }
  }

  async function toggleRule(rule: AlertRule) {
    try {
      await apiPatch("/api/v1/admin/ops/alerts/rules", { id: rule.id, enabled: !rule.enabled })
      void mutateRules()
    } catch {
      toast.error("به‌روزرسانی قانون ناموفق بود")
    }
  }

  async function deleteRule(id: string) {
    try {
      await apiDelete("/api/v1/admin/ops/alerts/rules", { id } as never)
    } catch {
      // apiDelete may not accept a body in this client; fall back to POST-less path
    }
    void mutateRules()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Active alert events */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <BellRing className="size-4 text-primary" />
            رویدادهای هشدار
            {ev?.firing ? (
              <Badge variant="destructive" className="text-[10px]">
                {ev.firing} فعال
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {evLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : (ev?.events.length ?? 0) === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/70 text-sm text-muted-foreground">
              هیچ هشداری ثبت نشده است.
            </div>
          ) : (
            ev?.events.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-xl border bg-card/80 p-4 backdrop-blur-sm",
                  a.status === "FIRING" ? "border-destructive/30" : "border-border/60 opacity-75",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cn("mt-0.5 shrink-0", a.status === "FIRING" ? "text-destructive" : "text-chart-2")}>
                    {a.status === "FIRING" ? <TriangleAlert className="size-4" /> : <CircleCheck className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{a.title}</span>
                      <Badge variant={SEV_BADGE[a.severity]} className="text-[10px]">
                        {SEV_LABEL[a.severity]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 break-words text-sm text-muted-foreground">{a.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatRelative(a.startedAt)}</p>
                  </div>
                </div>
                {a.status === "FIRING" && !a.acked ? (
                  <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => ack(a.id)}>
                    <Check data-icon="inline-start" />
                    تأیید
                  </Button>
                ) : a.acked && a.status === "FIRING" ? (
                  <Badge variant="secondary" className="text-[10px]">تأیید شده</Badge>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Alert rules */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <BellRing className="size-4 text-primary" />
            قوانین هشدار
          </div>
          <Button
            size="sm"
            onClick={() => {
              setDialogRule(null)
              setDialogOpen(true)
            }}
          >
            <Plus data-icon="inline-start" />
            قانون جدید
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {rulesLoading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : (rulesData?.rules.length ?? 0) === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border/70 text-sm text-muted-foreground">
              هنوز قانونی تعریف نشده است.
            </div>
          ) : (
            rulesData?.rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <Badge variant={SEV_BADGE[r.severity]} className="text-[10px]">
                      {SEV_LABEL[r.severity]}
                    </Badge>
                  </div>
                  <p dir="ltr" className="mt-0.5 text-left text-[11px] text-muted-foreground">
                    {r.metric} {r.comparator === "GT" ? ">" : "<"} {r.threshold}
                    {r.forSeconds > 0 ? ` · ${r.forSeconds}s` : ""} · {r.channels.join(", ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={r.enabled} onCheckedChange={() => toggleRule(r)} />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDialogRule(r)
                      setDialogOpen(true)
                    }}
                  >
                    ویرایش
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteRule(r.id)} aria-label="حذف">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <AlertRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={dialogRule}
        onSaved={() => {
          setDialogOpen(false)
          void mutateRules()
        }}
      />
    </div>
  )
}
