"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { AnimatePresence, motion } from "motion/react"
import { Check, ChevronLeft, Loader2, Send, Sparkles, Users } from "lucide-react"
import { fetcher, apiPost } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { GuardianMascot, type MascotState } from "@/components/onboarding/guardian-mascot"

/** Enriched required channel returned by the gate status endpoint. */
type GateChannel = {
  id: string
  title: string
  url: string
  description?: string
  memberCount?: number
}

type GateStatus = {
  enabled: boolean
  canVerify: boolean
  passed: boolean
  channels: GateChannel[]
  brandName: string
}

/**
 * Standalone forced-channel membership gate — a dedicated, premium verification
 * screen shown AFTER authentication + language selection and BEFORE the
 * dashboard. It is intentionally NOT part of the first-run onboarding flow:
 *
 *  - If forced join is disabled, the account can't be checked, or the user is
 *    already a member of every channel → the gate never shows (skipped).
 *  - Otherwise it overlays a beautiful card-based screen. When the user joins
 *    and we re-verify successfully, it fades straight into the app — no refresh.
 *
 * Mounted alongside the onboarding overlay (which sits above it, z-order-wise),
 * so a brand-new user sees language selection first, then this gate.
 */
export function ChannelGate() {
  const { user } = useSession()
  const { mutate } = useSWRConfig()
  const { data } = useSWR<{ data: GateStatus }>(
    user ? "/api/v1/channels/gate" : null,
    fetcher,
    { revalidateOnFocus: false },
  )

  const status = data?.data
  const [dismissed, setDismissed] = useState(false)

  const show =
    Boolean(status?.enabled) &&
    !status?.passed &&
    status!.channels.length > 0 &&
    !dismissed

  return (
    <AnimatePresence>
      {show && (
        <ChannelGateOverlay
          key="channel-gate"
          status={status!}
          onComplete={() => {
            setDismissed(true)
            // Re-sync the gate truth in the background (stays hidden either way).
            void mutate("/api/v1/channels/gate")
          }}
        />
      )}
    </AnimatePresence>
  )
}

type ChannelStatus = "idle" | "checking" | "joined" | "todo"
type VerifyState = "idle" | "checking" | "passed" | "failed"

function ChannelGateOverlay({
  status,
  onComplete,
}: {
  status: GateStatus
  onComplete: () => void
}) {
  const { t, locale } = useI18n()
  const { channels, canVerify, brandName } = status

  const [verify, setVerify] = useState<VerifyState>("idle")
  const [state, setState] = useState<Record<string, ChannelStatus>>({})
  const [mascot, setMascot] = useState<MascotState>("idle")

  const visitedRef = useRef<Set<string>>(new Set())
  const inFlightRef = useRef<Set<string>>(new Set())
  const stateRef = useRef(state)
  stateRef.current = state

  const setChannel = useCallback((id: string, s: ChannelStatus) => {
    setState((prev) => ({ ...prev, [id]: s }))
  }, [])

  /** Open a channel inside Telegram without dismissing the Mini App. */
  const openChannel = useCallback((ch: GateChannel) => {
    visitedRef.current.add(ch.id)
    const wa = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined
    if (wa?.openTelegramLink) wa.openTelegramLink(ch.url)
    else window.open(ch.url, "_blank", "noopener,noreferrer")
  }, [])

  /** Re-check a single channel when the user returns from visiting it. */
  const checkChannel = useCallback(
    async (id: string) => {
      if (inFlightRef.current.has(id)) return
      inFlightRef.current.add(id)
      setChannel(id, "checking")
      setMascot("checking")
      try {
        const res = canVerify
          ? await apiPost<{ data: { joined: boolean; verifiable: boolean } }>(
              "/api/v1/channels/verify-channel",
              { channelId: id },
            )
          : { data: { joined: true, verifiable: false } }
        setChannel(id, res.data.joined ? "joined" : "todo")
      } catch {
        setChannel(id, "todo")
      } finally {
        inFlightRef.current.delete(id)
        setTimeout(() => {
          if (inFlightRef.current.size === 0)
            setMascot((m) => (m === "checking" ? "idle" : m))
        }, 250)
      }
    },
    [canVerify, setChannel],
  )

  // Re-check visited (not-yet-joined) channels whenever the app regains focus.
  useEffect(() => {
    function onResume() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      const pending = [...visitedRef.current].filter((id) => stateRef.current[id] !== "joined")
      pending.forEach((id) => checkChannel(id))
    }
    document.addEventListener("visibilitychange", onResume)
    window.addEventListener("focus", onResume)
    const wa = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined
    wa?.onEvent?.("activated", onResume)
    return () => {
      document.removeEventListener("visibilitychange", onResume)
      window.removeEventListener("focus", onResume)
      wa?.offEvent?.("activated", onResume)
    }
  }, [checkChannel])

  /** Authoritative bulk re-check across every required channel. */
  async function verifyAll() {
    setVerify("checking")
    setMascot("checking")
    try {
      const res = canVerify
        ? await apiPost<{ data: { passed: boolean; missing: GateChannel[] } }>(
            "/api/v1/channels/verify",
          )
        : { data: { passed: true, missing: [] as GateChannel[] } }

      const missing = new Set(res.data.missing.map((c) => c.id))
      setState(() => {
        const next: Record<string, ChannelStatus> = {}
        for (const ch of channels) next[ch.id] = missing.has(ch.id) ? "todo" : "joined"
        return next
      })

      if (res.data.passed) {
        setVerify("passed")
        setMascot("passed")
        // Celebrate briefly, then hand off to the dashboard (no refresh).
        setTimeout(onComplete, 1400)
      } else {
        setVerify("failed")
        setMascot("failed")
        setTimeout(() => setMascot("idle"), 1300)
      }
    } catch {
      setVerify("failed")
      setMascot("failed")
      setTimeout(() => setMascot("idle"), 1300)
    }
  }

  const allJoined =
    channels.length > 0 && channels.every((ch) => state[ch.id] === "joined")

  const numberFmt = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.01 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[110] overflow-y-auto bg-background"
    >
      {/* Ambient cinematic backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, color-mix(in oklch, var(--primary) 14%, transparent) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Success takeover */}
        <AnimatePresence>
          {verify === "passed" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center backdrop-blur-sm"
            >
              <GuardianMascot state="passed" />
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-extrabold tracking-tight text-foreground"
              >
                {t("join.allSet")}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground"
              >
                {t("join.allSetDesc")}
              </motion.p>
              <Loader2 className="mt-1 h-5 w-5 animate-spin text-primary" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex flex-1 flex-col justify-center py-4">
          <GuardianMascot state={mascot} />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto mt-3 inline-flex items-center gap-1.5 self-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {brandName}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="mt-3 text-balance text-center text-2xl font-extrabold tracking-tight text-foreground"
          >
            {t("join.title")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mx-auto mt-2 max-w-xs text-pretty text-center text-sm leading-relaxed text-muted-foreground"
          >
            {t("join.subtitle", { brand: brandName })}
          </motion.p>

          {/* Channel cards */}
          <div className="mt-6 flex flex-col gap-3">
            {channels.map((ch, i) => {
              const st = state[ch.id] ?? "idle"
              const joined = st === "joined"
              const checking = st === "checking"
              const todo = st === "todo"
              return (
                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * i, type: "spring", stiffness: 260, damping: 24 }}
                  className={cn(
                    "relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 text-start transition-colors",
                    joined
                      ? "border-success/50 bg-success/[0.07]"
                      : todo
                        ? "border-destructive/40 bg-destructive/5"
                        : "glass border-border/60",
                  )}
                >
                  {/* Avatar */}
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 text-lg font-black text-primary ring-1 ring-primary/20">
                    {ch.title.trim().charAt(0).toUpperCase() || "#"}
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Send className="h-2.5 w-2.5" />
                    </span>
                  </span>

                  {/* Meta */}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-bold text-foreground">{ch.title}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {ch.description?.trim() || t("join.channelDesc")}
                    </span>
                    {typeof ch.memberCount === "number" && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/80">
                        <Users className="h-3 w-3" />
                        {t("join.members", { count: numberFmt.format(ch.memberCount) })}
                      </span>
                    )}
                  </div>

                  {/* Action / status */}
                  {joined ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 16 }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </motion.span>
                  ) : checking ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </span>
                  ) : (
                    <motion.button
                      type="button"
                      onClick={() => openChannel(ch)}
                      whileTap={{ scale: 0.95 }}
                      className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground"
                    >
                      {t("join.joinCta")}
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </motion.button>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Bottom verify CTA */}
        <div className="shrink-0">
          <motion.button
            type="button"
            onClick={verifyAll}
            disabled={verify === "checking" || verify === "passed"}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "elevate-gold flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-colors disabled:opacity-70",
              allJoined ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground",
            )}
          >
            {verify === "checking" && <Loader2 className="h-5 w-5 animate-spin" />}
            {verify === "idle" && (allJoined ? t("join.enter") : t("join.checkMe"))}
            {verify === "checking" && t("join.verifying")}
            {verify === "failed" && t("join.retry")}
          </motion.button>

          {verify === "failed" && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-center text-xs text-destructive"
            >
              {t("join.failed")}
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
