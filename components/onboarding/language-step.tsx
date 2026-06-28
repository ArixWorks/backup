"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Check, ChevronLeft, Headphones, Shield, Sparkles, Zap } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { LOCALE_NAMES, type Locale } from "@/lib/i18n/locales"
import { LanguageGlobe } from "./language-globe"
import { cn } from "@/lib/utils"

/**
 * First-run language picker — the user's first impression of the platform.
 *
 * A cinematic golden-globe hero sits above four glassmorphic language cards
 * (animated flag, native name, ISO country code, animated selection check) and
 * a luxe gold CTA with a continuous light sweep. Trust badges anchor the foot.
 * All motion is GPU-friendly and respects prefers-reduced-motion.
 */
export function LanguageStep({ onContinue }: { onContinue: () => void }) {
  const { locale, setLocale } = useI18n()
  const [selected, setSelected] = useState<Locale>(locale)

  function pick(next: Locale) {
    setSelected(next)
    setLocale(next)
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center text-center">
      {/* Cinematic hero */}
      <LanguageGlobe />

      {/* Title with sparkle accents */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5"
      >
        <h1 className="flex items-center justify-center gap-2 text-2xl font-extrabold tracking-tight text-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-balance">زبان خود را انتخاب کنید</span>
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        </h1>
        <p className="mt-1.5 text-sm tracking-wide text-muted-foreground">Select your language</p>
      </motion.div>

      {/* Language cards */}
      <div className="mt-7 grid w-full grid-cols-2 gap-3">
        {DISPLAY_ORDER.map((code, i) => {
          const active = selected === code
          return (
            <motion.button
              key={code}
              type="button"
              onClick={() => pick(code)}
              aria-pressed={active}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + 0.07 * i, type: "spring", stiffness: 240, damping: 22 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              className={cn(
                "glass group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3.5 text-start transition-colors duration-300",
                active
                  ? "border-primary/70 bg-primary/[0.07]"
                  : "border-border/60 hover:border-primary/40",
              )}
            >
              {/* Active glow + moving sheen */}
              {active && (
                <>
                  <span
                    aria-hidden
                    className="animate-glow pointer-events-none absolute -inset-px rounded-2xl bg-[radial-gradient(120%_120%_at_50%_0%,color-mix(in_oklch,var(--primary)_30%,transparent),transparent_70%)]"
                  />
                  <span className="sheen pointer-events-none absolute inset-0 rounded-2xl" />
                </>
              )}

              {/* Waving flag chip */}
              <span
                aria-hidden
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background/60 ring-1 ring-border/60"
              >
                <span className={cn("text-xl leading-none", active && "animate-flag")}>
                  {FLAG[code]}
                </span>
              </span>

              <span className="relative flex-1 text-sm font-bold text-foreground">
                {LOCALE_NAMES[code]}
              </span>

              {/* Country code badge */}
              <span className="relative rounded-md bg-background/55 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground ring-1 ring-border/50">
                {COUNTRY_CODE[code]}
              </span>

              {/* Animated selection check */}
              <span
                className={cn(
                  "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border-2 border-muted-foreground/40",
                )}
              >
                {active && (
                  <motion.span
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3.5} />
                  </motion.span>
                )}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Premium continue CTA */}
      <motion.button
        type="button"
        onClick={onContinue}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 220, damping: 22 }}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.97 }}
        className="bg-gold sheen elevate-gold relative mt-7 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 text-base font-extrabold text-primary-foreground"
      >
        <span className="relative z-[2]">ادامه</span>
        <ChevronLeft className="relative z-[2] h-5 w-5" />
      </motion.button>

      {/* Trust badges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.5 }}
        className="mt-7 flex w-full items-stretch justify-center"
      >
        {TRUST.map((b, i) => (
          <div key={b.fa} className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-1.5 px-2 text-center">
              <b.icon className="h-5 w-5 text-primary" aria-hidden />
              <span className="text-xs font-bold text-foreground">{b.fa}</span>
              <span className="text-[10px] text-muted-foreground">{b.en}</span>
            </div>
            {i < TRUST.length - 1 && <span className="h-9 w-px bg-border/60" aria-hidden />}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

/** Display order chosen to match the reference layout (en, fa, hi, ru). */
const DISPLAY_ORDER: Locale[] = ["en", "fa", "hi", "ru"]

/** Flag emoji per locale. */
const FLAG: Record<Locale, string> = {
  fa: "🇮🇷",
  en: "🇬🇧",
  ru: "🇷🇺",
  hi: "🇮🇳",
}

/** ISO country code shown as a small badge on each card. */
const COUNTRY_CODE: Record<Locale, string> = {
  fa: "IR",
  en: "GB",
  ru: "RU",
  hi: "IN",
}

/** Bilingual trust badges anchoring the foot of the screen. */
const TRUST = [
  { icon: Shield, fa: "امن و مطمئن", en: "Secure & Safe" },
  { icon: Zap, fa: "سریع و آسان", en: "Fast & Easy" },
  { icon: Headphones, fa: "پشتیبانی ۲۴/۷", en: "24/7 Support" },
] as const
