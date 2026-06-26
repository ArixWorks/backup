"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Send, Users, ChevronLeft, Check, ShieldCheck, Loader2 } from "lucide-react"
import { apiPost } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import type { OnboardChannel } from "./onboarding-flow"

type VerifyState = "idle" | "checking" | "passed" | "failed"

/**
 * Members-only join gate. Lists every required channel as a tappable join card,
 * then a "verify" button that runs a staged check against Telegram and shows a
 * terminal-style "access granted" before advancing.
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
  const [state, setState] = useState<VerifyState>("idle")
  const [stage, setStage] = useState(0)
  const [missing, setMissing] = useState<string[]>([])

  async function verify() {
    setState("checking")
    setMissing([])
    // Staged progress feedback (purely cosmetic) while the real check runs.
    const total = Math.max(channels.length, 1)
    setStage(0)
    const ticker = setInterval(() => {
      setStage((s) => (s < total ? s + 1 : s))
    }, 520)

    try {
      // When the account can't be verified (no Telegram id / forced join off),
      // the API passes automatically.
      const res = canVerify
        ? await apiPost<{ data: { passed: boolean; missing: OnboardChannel[] } }>(
            "/api/v1/onboarding/verify",
          )
        : { data: { passed: true, missing: [] as OnboardChannel[] } }

      clearInterval(ticker)
      setStage(total)

      if (res.data.passed) {
        setState("passed")
        setTimeout(onPassed, 900)
      } else {
        setMissing(res.data.missing.map((c) => c.title))
        setState("failed")
      }
    } catch {
      clearInterval(ticker)
      setState("failed")
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/12 text-primary surface-glow"
      >
        <ShieldCheck className="h-10 w-10" />
      </motion.div>

      <h1 className="text-balance text-center text-2xl font-extrabold tracking-tight text-foreground">
        فقط برای اعضا
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-pretty text-center text-sm leading-relaxed text-muted-foreground">
        برای استفاده از {brandName} ابتدا در کانال و گروه ما عضو شوید، سپس دکمهٔ بررسی را بزنید.
      </p>

      <div className="mt-7 flex flex-col gap-3">
        {channels.map((ch, i) => (
          <motion.a
            key={ch.id}
            href={ch.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, type: "spring", stiffness: 260, damping: 24 }}
            whileTap={{ scale: 0.98 }}
            className="glass flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-3.5 text-right transition-colors hover:border-primary/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              {i === 0 ? <Send className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            </span>
            <span className="flex-1 text-sm font-semibold text-foreground">{ch.title}</span>
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </motion.a>
        ))}
      </div>

      {/* Verify button + staged status */}
      <div className="mt-6">
        <motion.button
          type="button"
          onClick={verify}
          disabled={state === "checking" || state === "passed"}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "elevate-gold flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-colors",
            state === "passed"
              ? "bg-emerald-500 text-white"
              : "bg-primary text-primary-foreground",
          )}
        >
          {state === "checking" && <Loader2 className="h-5 w-5 animate-spin" />}
          {state === "passed" && <Check className="h-5 w-5" />}
          {state === "idle" && "عضو شدم، بررسی کن"}
          {state === "checking" && "در حال بررسی…"}
          {state === "passed" && "تأیید شد"}
          {state === "failed" && "دوباره بررسی کن"}
        </motion.button>

        {/* Terminal-style verification log */}
        {(state === "checking" || state === "passed") && (
          <div className="mt-3 rounded-xl bg-card/60 p-3 font-mono text-xs" dir="ltr">
            {channels.map((ch, i) => (
              <div key={ch.id} className="flex items-center gap-2 py-0.5">
                {stage > i ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                <span className={stage > i ? "text-emerald-400" : "text-muted-foreground"}>
                  checking {ch.title}…
                </span>
              </div>
            ))}
            {state === "passed" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-1 text-emerald-400"
              >
                {"> access granted"}
              </motion.div>
            )}
          </div>
        )}

        {state === "failed" && (
          <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
            {missing.length > 0
              ? `هنوز عضو نشده‌اید: ${missing.join("، ")}`
              : "عضویت تأیید نشد. لطفاً ابتدا عضو شوید و دوباره تلاش کنید."}
          </p>
        )}
      </div>
    </div>
  )
}
