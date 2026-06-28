"use client"

import { useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { AnimatePresence, motion } from "motion/react"
import { fetcher, apiPost } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { JoinGateStep } from "./join-gate-step"
import { LanguageStep } from "./language-step"
import { TutorialStep } from "./tutorial-step"
import { SuccessStep } from "./success-step"

export type OnboardChannel = { id: string; title: string; url: string }

type OnboardingStatus = {
  needsOnboarding: boolean
  joinEnabled: boolean
  canVerify: boolean
  channels: OnboardChannel[]
  brandName: string
}

type Step = "join" | "language" | "tutorial" | "success"

/**
 * Full first-run onboarding flow, shown as a blocking fullscreen overlay for
 * signed-in users who haven't completed it yet. Sequence:
 *   join gate (forced-channel membership) → language picker → guided tutorial
 *   → "you're all set" success → mark complete.
 *
 * The join step is skipped automatically when forced join is disabled or the
 * account can't be membership-checked, so the flow never dead-ends.
 */
export function OnboardingFlow() {
  const { user, refresh } = useSession()
  const { mutate } = useSWRConfig()
  const { data } = useSWR<{ data: OnboardingStatus }>(
    user ? "/api/v1/onboarding" : null,
    fetcher,
  )

  const status = data?.data
  const [step, setStep] = useState<Step | null>(null)
  const [finishing, setFinishing] = useState(false)

  // Decide the entry step once the status loads.
  const resolvedStep: Step | null =
    step ??
    (status
      ? status.joinEnabled && status.channels.length > 0
        ? "join"
        : "language"
      : null)

  if (!user || !status || !status.needsOnboarding) return null
  if (!resolvedStep) return null

  async function complete() {
    setFinishing(true)
    try {
      await apiPost("/api/v1/onboarding/complete")
    } catch {
      /* best-effort; the overlay still closes */
    }
    await mutate("/api/v1/onboarding")
    await refresh()
  }

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-background">
      {/* Ambient cinematic backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, color-mix(in oklch, var(--primary) 14%, transparent) 0%, transparent 60%)",
        }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={resolvedStep}
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.99 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-y-auto px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {resolvedStep === "join" && (
            <JoinGateStep
              channels={status.channels}
              canVerify={status.canVerify}
              brandName={status.brandName}
              onPassed={() => setStep("language")}
            />
          )}
          {resolvedStep === "language" && (
            <LanguageStep onContinue={() => setStep("tutorial")} />
          )}
          {resolvedStep === "tutorial" && (
            <TutorialStep
              onDone={() => setStep("success")}
              onSkip={() => setStep("success")}
            />
          )}
          {resolvedStep === "success" && (
            <SuccessStep busy={finishing} onStart={complete} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
