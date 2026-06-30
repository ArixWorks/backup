"use client"

import { Check, Gauge, Sparkles, Waves, Minus, Zap } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { useMotion, MOTION_PREFS, type MotionPref } from "@/components/motion-provider"
import type { MessageKey } from "@/lib/i18n/messages"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const PREF_META: Record<MotionPref, { label: MessageKey; icon: typeof Gauge }> = {
  auto: { label: "motion.auto", icon: Gauge },
  cinematic: { label: "motion.cinematic", icon: Sparkles },
  balanced: { label: "motion.balanced", icon: Waves },
  minimal: { label: "motion.minimal", icon: Minus },
}

/** Compact motion-quality picker. Mirrors LanguageSwitcher for visual parity. */
export function MotionQualitySwitcher() {
  const { t } = useI18n()
  const { pref, setPref, tier, reducedMotion } = useMotion()
  const ActiveIcon = PREF_META[pref].icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="active:scale-press flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        aria-label={t("motion.choose")}
      >
        <ActiveIcon className="h-3.5 w-3.5 text-primary" />
        {t(PREF_META[pref].label)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {MOTION_PREFS.map((p) => {
          const Icon = PREF_META[p].icon
          return (
            <DropdownMenuItem
              key={p}
              onClick={() => setPref(p)}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {t(PREF_META[p].label)}
                {/* Show which tier Auto currently resolves to. */}
                {p === "auto" && pref === "auto" ? (
                  <span className="text-[10px] text-muted-foreground">
                    · {t(PREF_META[tier].label)}
                  </span>
                ) : null}
              </span>
              {pref === p && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          )
        })}
        <div className="flex items-start gap-1.5 px-2 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Zap className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          <span>{reducedMotion ? t("motion.minimal") : t("motion.hint")}</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
