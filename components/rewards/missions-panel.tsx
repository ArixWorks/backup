"use client"

import { useState } from "react"
import { toast } from "sonner"
import * as Icons from "lucide-react"
import { Check, Loader2 } from "lucide-react"
import { apiPost, ApiError } from "@/lib/api-client"
import { formatNumber } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

export type Mission = {
  id: string
  key: string
  kind: "DAILY" | "WEEKLY"
  title: string
  description: string
  icon: string
  href: string | null
  target: number
  rewardPoints: number
  progress: number
  completed: boolean
  claimed: boolean
}

function MissionIcon({ name }: { name: string }) {
  const Icon = (Icons as Record<string, unknown>)[name] as Icons.LucideIcon | undefined
  const Resolved = Icon ?? Icons.Target
  return <Resolved className="h-5 w-5" />
}

function MissionRow({ mission, onClaimed }: { mission: Mission; onClaimed: () => void }) {
  const { t, errorMessage } = useI18n()
  const [claiming, setClaiming] = useState(false)
  const title = t(`missions.${mission.key}.title` as MessageKey)
  const description = t(`missions.${mission.key}.description` as MessageKey)
  const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100))

  async function claim() {
    setClaiming(true)
    try {
      const res = await apiPost<{ data: { points: number } }>("/api/v1/rewards/claim", { missionId: mission.id })
      const awardedPoints = Number.isFinite(res.data.points) ? res.data.points : mission.rewardPoints
      toast.success(t("missions.pointsReceived", { points: formatNumber(awardedPoints) }))
      onClaimed()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          mission.claimed ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
        }`}
      >
        {mission.claimed ? <Check className="h-5 w-5" /> : <MissionIcon name={mission.icon} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-foreground">{title}</p>
          <span className="shrink-0 text-xs font-bold text-primary">+{formatNumber(mission.rewardPoints)}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground">
            {formatNumber(mission.progress)}/{formatNumber(mission.target)}
          </span>
        </div>
      </div>

      {mission.completed && !mission.claimed && (
        <button
          onClick={claim}
          disabled={claiming}
          className="active:scale-press bg-gold inline-flex shrink-0 items-center justify-center rounded-lg px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : t("missions.claim")}
        </button>
      )}
    </div>
  )
}

export function MissionsPanel({ missions, onClaimed }: { missions: Mission[]; onClaimed: () => void }) {
  const { t } = useI18n()
  const daily = missions.filter((m) => m.kind === "DAILY")
  const weekly = missions.filter((m) => m.kind === "WEEKLY")

  return (
    <div className="space-y-5">
      {daily.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-foreground">{t("missions.daily")}</h3>
          <div className="space-y-2">
            {daily.map((m) => (
              <MissionRow key={m.id} mission={m} onClaimed={onClaimed} />
            ))}
          </div>
        </section>
      )}
      {weekly.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-foreground">{t("missions.weekly")}</h3>
          <div className="space-y-2">
            {weekly.map((m) => (
              <MissionRow key={m.id} mission={m} onClaimed={onClaimed} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
