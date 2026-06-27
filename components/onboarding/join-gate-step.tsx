"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { Send, Users, ChevronLeft, Check, Loader2 } from "lucide-react"
import { apiPost } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { GuardianMascot, type MascotState } from "./guardian-mascot"
import type { OnboardChannel } from "./onboarding-flow"

/** Per-channel tick state. */
type ChannelStatus = "idle" | "checking" | "joined" | "todo"
type VerifyState = "idle" | "checking" | "passed" | "failed"

/**
 * Members-only join gate. Each required channel is a tappable card; tapping it
 * opens the channel **inside Telegram without closing the Mini App** (via
 * WebApp.openTelegramLink). When the user returns, that channel is re-checked:
 *  - if the bot is admin of the channel → real membership check (truthful tick)
 *  - if not → optimistic green tick (the bot can't enforce it anyway).
 *
 * A friendly guardian mascot up top tracks the pointer/touch and reacts to the
 * verification lifecycle (scanning while checking, celebrating on success).
 */
export function JoinGateStep({
  channels,
  canVerify,
  brandName,
  onPassed,
}: {
  channels: OnboardChannel[]
  canVerify: boolean
  brandName: string
  onPassed: () => void
}) {
  const [verify, setVerify] = useState<VerifyState>("idle")
  const [status, setStatus] = useState<Record<string, ChannelStatus>>({})
  const [mascot, setMascot] = useState<MascotState>("idle")

  // Refs to read latest values inside event handlers without re-subscribing.
  const visitedRef = useRef<Set<string>>(new Set())
  const inFlightRef = useRef<Set<string>>(new Set())
  const statusRef = useRef(status)
  statusRef.current = status

  const setChannel = useCallback((id: string, s: ChannelStatus) => {
    setStatus((prev) => ({ ...prev, [id]: s }))
  }, [])

  /** Open a channel without dismissing the Mini App. */
  const openChannel = useCallback((ch: OnboardChannel) => {
    visitedRef.current.add(ch.id)
    const wa = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined
    if (wa?.openTelegramLink) {
      wa.openTelegramLink(ch.url)
    } else {
      window.open(ch.url, "_blank", "noopener,noreferrer")
    }
  }, [])

  /** Verify a single channel (used when the user returns from visiting it). */
  const checkChannel = useCallback(
    async (id: string) => {
      if (inFlightRef.current.has(id)) return
      inFlightRef.current.add(id)
      setChannel(id, "checking")
      setMascot("checking")
      try {
        const res = canVerify
          ? await apiPost<{ data: { joined: boolean; verifiable: boolean } }>(
              "/api/v1/onboarding/verify-channel",
              { channelId: id },
            )
          : { data: { joined: true, verifiable: false } }
        setChannel(id, res.data.joined ? "joined" : "todo")
      } catch {
        // Network hiccup — leave it as "todo" so the user can retry.
        setChannel(id, "todo")
      } finally {
        inFlightRef.current.delete(id)
        // Settle the mascot back to idle if nothing else is in-flight.
        setTimeout(() => {
          if (inFlightRef.current.size === 0) setMascot((m) => (m === "checking" ? "idle" : m))
        }, 250)
      }
    },
    [canVerify, setChannel],
  )

  // Re-check visited (not-yet-joined) channels whenever the app regains focus —
  // i.e. the user came back from a channel they opened.
  useEffect(() => {
    function onResume() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      const pending = [...visitedRef.current].filter((id) => statusRef.current[id] !== "joined")
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

  /** Final gate: the authoritative bulk check across every required channel. */
  async function verifyAll() {
    setVerify("checking")
    setMascot("checking")
    try {
      const res = canVerify
        ? await apiPost<{ data: { passed: boolean; missing: OnboardChannel[] } }>(
            "/api/v1/onboarding/verify",
          )
        : { data: { passed: true, missing: [] as OnboardChannel[] } }

      const missing = new Set(res.data.missing.map((c) => c.id))
      // Reflect the truth on every card.
      setStatus(() => {
        const next: Record<string, ChannelStatus> = {}
        for (const ch of channels) next[ch.id] = missing.has(ch.id) ? "todo" : "joined"
        return next
      })

      if (res.data.passed) {
        setVerify("passed")
        setMascot("passed")
        setTimeout(onPassed, 1100)
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
    channels.length > 0 && channels.every((ch) => status[ch.id] === "joined")

  return (
    <div className="flex flex-1 flex-col justify-center py-2">
      <GuardianMascot state={mascot} />

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 text-balance text-center text-2xl font-extrabold tracking-tight text-foreground"
      >
        فقط برای اعضا
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mx-auto mt-2 max-w-xs text-pretty text-center text-sm leading-relaxed text-muted-foreground"
      >
        برای استفاده از {brandName} روی هر کانال بزن و عضو شو؛ بعد از بازگشت، تیک سبز روشن می‌شود.
      </motion.p>

      <div className="mt-6 flex flex-col gap-3">
        {channels.map((ch, i) => {
          const st = status[ch.id] ?? "idle"
          const joined = st === "joined"
          const checking = st === "checking"
          const todo = st === "todo"
          return (
            <motion.button
              key={ch.id}
              type="button"
              onClick={() => openChannel(ch)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, type: "spring", stiffness: 260, damping: 24 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-right transition-colors",
                joined
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : todo
                    ? "border-destructive/40 bg-destructive/5"
                    : "glass border-border/60 hover:border-primary/40",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                  joined ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400",
                )}
              >
                {i === 0 ? <Send className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-foreground">{ch.title}</span>
                {todo && (
                  <span className="text-xs text-destructive">هنوز عضو نشده‌اید — دوباره امتحان کن</span>
                )}
                {joined && <span className="text-xs text-emerald-400">عضویت تأیید شد</span>}
              </span>

              {/* Trailing state indicator */}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                {checking ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : joined ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 16 }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white"
                  >
                    <Check className="h-4 w-4" />
                  </motion.span>
                ) : (
                  <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                )}
              </span>
            </motion.button>
          )
        })}
      </div>

      <div className="mt-6">
        <motion.button
          type="button"
          onClick={verifyAll}
          disabled={verify === "checking" || verify === "passed"}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "elevate-gold flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-colors",
            verify === "passed" || allJoined
              ? "bg-emerald-500 text-white"
              : "bg-primary text-primary-foreground",
          )}
        >
          {verify === "checking" && <Loader2 className="h-5 w-5 animate-spin" />}
          {(verify === "passed") && <Check className="h-5 w-5" />}
          {verify === "idle" && (allJoined ? "ورود به اپ" : "عضو شدم، بررسی کن")}
          {verify === "checking" && "در حال بررسی…"}
          {verify === "passed" && "تأیید شد"}
          {verify === "failed" && "دوباره بررسی کن"}
        </motion.button>

        {verify === "failed" && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-center text-xs text-destructive"
          >
            عضویت همه‌ی کانال‌ها تأیید نشد. ابتدا عضو شو، سپس دوباره بررسی کن.
          </motion.p>
        )}
      </div>
    </div>
  )
}
