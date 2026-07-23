"use client"

import { useEffect, useMemo } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Check, Crown, Gavel, ShoppingBag, Sparkles, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"
import { fireEntryConfetti, fireWinConfetti, resetConfetti } from "@/lib/celebration-fx"
import { playCelebrationSound } from "@/lib/notification-sound"

export type CelebrationKind = "purchase" | "auction-win" | "giveaway-entry" | "giveaway-win"

const copy = {
  fa: {
    purchase: ["خرید با موفقیت انجام شد", "محصول برای شما ثبت شد. از خریدتان لذت ببرید.", "مشاهده سفارش‌ها"],
    "auction-win": ["این مزایده برای شماست", "تبریک، شما برنده نهایی این مزایده شدید.", "مشاهده جزئیات"],
    "giveaway-entry": ["ورود شما ثبت شد", "حالا شما یکی از شرکت‌کنندگان این قرعه‌کشی هستید.", "ادامه"],
    "giveaway-win": ["نام شما برنده شد", "تبریک، جایزه این قرعه‌کشی متعلق به شماست.", "مشاهده جایزه"],
  },
  en: {
    purchase: ["Purchase complete", "Your product has been secured. Enjoy your purchase.", "View orders"],
    "auction-win": ["The auction is yours", "Congratulations, you are the confirmed winner.", "View details"],
    "giveaway-entry": ["Entry confirmed", "You are now officially in the giveaway draw.", "Continue"],
    "giveaway-win": ["Your name was drawn", "Congratulations, this giveaway prize is yours.", "View prize"],
  },
} as const

const eyebrows = {
  fa: {
    purchase: "سفارش تایید شد",
    "auction-win": "برنده مزایده",
    "giveaway-entry": "لحظه ویژه شما",
    "giveaway-win": "شما برنده شدید",
  },
  en: {
    purchase: "ORDER CONFIRMED",
    "auction-win": "AUCTION WON",
    "giveaway-entry": "YOUR MOMENT",
    "giveaway-win": "YOU WON",
  },
} as const

const icons = {
  purchase: ShoppingBag,
  "auction-win": Gavel,
  "giveaway-entry": Check,
  "giveaway-win": Trophy,
} as const

export function CelebrationOverlay({
  open,
  kind,
  subject,
  image,
  onClose,
  actionHref,
}: {
  open: boolean
  kind: CelebrationKind
  subject?: string | null
  image?: string | null
  onClose: () => void
  actionHref?: string
}) {
  const { locale } = useI18n()
  const reduced = useReducedMotion()
  const language = locale === "fa" ? "fa" : "en"
  const [title, description, action] = copy[language][kind]
  const eyebrow = eyebrows[language][kind]
  const Icon = icons[kind]

  const isWin = kind === "giveaway-win" || kind === "auction-win"
  // Winners get the gold/primary treatment; entries + purchases get success.
  const isSuccess = kind === "giveaway-entry" || kind === "purchase"

  const tone = isSuccess
    ? {
        text: "text-success",
        btn: "bg-success text-success-foreground hover:bg-success/90",
        c1: "var(--success)",
        c2: "color-mix(in oklab, var(--success) 45%, white)",
        c3: "var(--primary)",
        glow: "color-mix(in oklab, var(--success) 42%, transparent)",
        badgeBg: "var(--success)",
        badgeFg: "var(--success-foreground)",
      }
    : {
        text: "text-primary",
        btn: "bg-primary text-primary-foreground hover:bg-primary/90",
        c1: "var(--primary)",
        c2: "var(--accent-2)",
        c3: "var(--success)",
        glow: "color-mix(in oklab, var(--primary) 42%, transparent)",
        badgeBg: "var(--primary)",
        badgeFg: "var(--primary-foreground)",
      }

  // Sparkles that float *outside* the medallion (never clipping its ring).
  const twinkles = useMemo(
    () => [
      { style: { top: "-8%", insetInlineStart: "10%" }, size: 15, delay: 0.35 },
      { style: { top: "6%", insetInlineEnd: "-6%" }, size: 19, delay: 0.55 },
      { style: { bottom: "4%", insetInlineStart: "-6%" }, size: 13, delay: 0.75 },
      { style: { top: "-10%", insetInlineEnd: "24%" }, size: 11, delay: 0.95 },
    ],
    [],
  )

  // Scroll lock + Escape to close.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", dismiss)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", dismiss)
    }
  }, [onClose, open])

  // Confetti + sound. Kept separate from the scroll/esc effect so an unstable
  // onClose identity can't re-trigger the celebration on every render.
  useEffect(() => {
    if (!open) return
    if (isWin) fireWinConfetti()
    else fireEntryConfetti()
    playCelebrationSound(isWin ? "win" : "entry")
    return () => resetConfetti()
  }, [open, isWin])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-overlay/45 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.12 : 0.35 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebration-title"
        >
          {/* Rotating sunburst behind the card. */}
          <motion.div
            className="celebration-beam"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: isWin ? 1 : 0.7, scale: isWin ? 1.15 : 1, rotate: reduced ? 0 : isWin ? 360 : 12 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : isWin
                  ? { rotate: { duration: 26, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.9 }, scale: { duration: 0.9 } }
                  : { duration: 0.9, ease: [0.22, 1, 0.36, 1] }
            }
          />

          <motion.section
            className={cn(
              "relative flex w-full max-w-sm flex-col items-center gap-5 rounded-[1.75rem] border border-border bg-card p-7 text-center shadow-2xl",
            )}
            initial={{ opacity: 0, y: reduced ? 0 : 34, scale: reduced ? 1 : 0.86 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 24, delay: reduced ? 0 : 0.12 }}
          >
            {/* Themed top glow, clipped to the card's radius. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden="true">
              <div
                className="absolute inset-x-0 -top-24 h-48 opacity-70"
                style={{ background: `radial-gradient(60% 100% at 50% 0%, ${tone.glow} 0%, transparent 70%)` }}
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="absolute end-3 top-3 z-10 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={language === "fa" ? "بستن" : "Close"}
            >
              <X className="size-5" />
            </button>

            {/* Medallion */}
            <motion.div
              className="relative mt-2 size-28"
              animate={reduced ? undefined : { y: [0, -6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Soft glow halo */}
              <div
                className="absolute inset-0 -z-10 rounded-full blur-2xl"
                aria-hidden="true"
                style={{ background: `radial-gradient(circle, ${tone.glow} 0%, transparent 72%)` }}
              />

              {/* Crown for winners */}
              {isWin && (
                <motion.div
                  className={cn("absolute -top-7 left-1/2 -translate-x-1/2", tone.text)}
                  initial={reduced ? { opacity: 1 } : { y: -10, opacity: 0, rotate: -14 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ delay: reduced ? 0 : 0.3, type: "spring", stiffness: 260, damping: 16 }}
                  aria-hidden="true"
                >
                  <Crown className="size-9 drop-shadow" fill="currentColor" strokeWidth={1.4} />
                </motion.div>
              )}

              {/* Rotating gradient ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                aria-hidden="true"
                style={{ background: `conic-gradient(from 0deg, ${tone.c1}, ${tone.c2}, ${tone.c3}, ${tone.c1})` }}
                animate={reduced ? undefined : { rotate: 360 }}
                transition={{ duration: isWin ? 6 : 10, repeat: Infinity, ease: "linear" }}
              />

              {/* Static inner disc holding the image / icon */}
              <div className="absolute inset-[3px] flex items-center justify-center overflow-hidden rounded-full bg-secondary">
                {image ? (
                  <img src={image || "/placeholder.svg"} alt="" className="size-full object-cover" />
                ) : (
                  <Icon className={cn("size-11", tone.text)} strokeWidth={1.7} />
                )}
                <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" aria-hidden="true" />
              </div>

              {/* Status badge, cleanly anchored at the bottom-center */}
              <div
                className="absolute -bottom-1.5 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border-2 border-card shadow-lg"
                style={{ background: tone.badgeBg, color: tone.badgeFg }}
              >
                <Icon className="size-4" strokeWidth={2.4} />
              </div>

              {/* Floating twinkles (outside the ring) */}
              {!reduced &&
                twinkles.map((tw, i) => (
                  <motion.span
                    key={i}
                    className={cn("absolute", tone.text)}
                    style={tw.style}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0.4, 1], scale: [0, 1, 0.85, 1] }}
                    transition={{ duration: 2.4, delay: tw.delay, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden="true"
                  >
                    <Sparkles style={{ width: tw.size, height: tw.size }} />
                  </motion.span>
                ))}
            </motion.div>

            <div className="flex flex-col gap-2">
              <p className={cn("text-xs font-bold uppercase tracking-wide", tone.text)}>{eyebrow}</p>
              <h2
                id="celebration-title"
                className={cn(
                  "text-balance font-extrabold leading-tight text-card-foreground",
                  isWin ? "text-[1.7rem]" : "text-2xl",
                )}
              >
                {title}
              </h2>
              {subject ? (
                <p dir="auto" className="text-pretty font-bold text-card-foreground">
                  {subject}
                </p>
              ) : null}
              <p className="text-pretty text-sm leading-6 text-muted-foreground">{description}</p>
            </div>

            {actionHref ? (
              <a
                href={actionHref}
                className={cn(
                  "inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-bold shadow-lg transition-colors",
                  tone.btn,
                )}
              >
                {action}
              </a>
            ) : (
              <Button onClick={onClose} className={cn("h-12 w-full rounded-2xl font-bold shadow-lg", tone.btn)}>
                {action}
              </Button>
            )}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
