"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { Countdown } from "@/components/countdown"
import {
  computeGiveawayDisplayState,
  type GiveawayScheduleInput,
} from "@/lib/core/giveaway/display-state"
import type { MessageKey } from "@/lib/i18n/messages"

/**
 * Phase-aware giveaway countdown. Shows the right caption + live timer for the
 * current lifecycle phase, and falls back to a stopped status line (paused,
 * awaiting draw, finished, ...) when there is nothing to count down to. The
 * final-minute red blink is inherited from <Countdown blinkBelowSec>.
 */
export function GiveawayPhaseCountdown({
  giveaway,
  onPhaseEnd,
  className,
}: {
  giveaway: GiveawayScheduleInput
  /** Called when a running timer hits zero so the parent can refetch. */
  onPhaseEnd?: () => void
  className?: string
}) {
  const { t } = useI18n()
  // Recompute on mount and whenever a timer completes; a lightweight tick key
  // forces the display-state to be recalculated against a fresh `now`.
  const [tick, setTick] = useState(0)
  const state = computeGiveawayDisplayState(giveaway)

  // Re-evaluate shortly after a boundary passes even without an explicit
  // onComplete (covers the BEFORE_START -> ACCEPTING transition).
  useEffect(() => {
    if (!state.target) return
    const ms = new Date(state.target).getTime() - Date.now()
    if (ms <= 0 || ms > 24 * 60 * 60 * 1000) return
    const id = setTimeout(() => setTick((n) => n + 1), ms + 400)
    return () => clearTimeout(id)
  }, [state.target, tick])

  const captionKey = state.captionKey as MessageKey
  const statusKey = state.statusKey as MessageKey

  return (
    <div
      className={cn(
        "card-premium flex flex-col items-center justify-center gap-1 rounded-2xl border p-4 text-center",
        state.phase === "PAUSED" || state.phase === "CANCELLED"
          ? "border-border"
          : "border-border",
        className,
      )}
    >
      <Clock
        className={cn(
          "h-4 w-4",
          state.phase === "PAUSED" ? "text-muted-foreground" : "text-primary",
        )}
      />
      <span className="text-[11px] text-muted-foreground">{t(captionKey)}</span>

      {state.target ? (
        <Countdown
          key={state.target}
          target={state.target}
          onComplete={() => {
            setTick((n) => n + 1)
            onPhaseEnd?.()
          }}
          className="text-lg font-extrabold text-gold"
        />
      ) : (
        <span
          className={cn(
            "text-balance text-base font-extrabold leading-6",
            state.phase === "PAUSED" || state.phase === "CANCELLED"
              ? "text-muted-foreground"
              : "text-gold",
          )}
        >
          {t(statusKey)}
        </span>
      )}

      {state.extended && state.phase === "ACCEPTING" && (
        <span className="mt-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-gold">
          {t("gwPhase.extended")}
        </span>
      )}
    </div>
  )
}
