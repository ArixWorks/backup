"use client"

import { useState } from "react"
import Image from "next/image"
import { motion } from "motion/react"
import { Check, ChevronLeft, Headphones, Shield, Sparkles, Zap } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { LOCALE_NAMES, type Locale } from "@/lib/i18n/locales"
import { LanguageGlobe } from "./language-globe"
import { cn } from "@/lib/utils"

/**
 * First-run language picker — the user's first impression of the platform.
 *
 * Designed as a single, non-scrolling welcome screen: a flexible cinematic
 * globe hero (which shrinks to fit short viewports) sits above four glass
 * language cards, a luxe gold CTA, and floating trust badges. Vertical rhythm
 * uses clamp() so the whole composition fits inside the Telegram Mini App
 * viewport on Android, iPhone, and Desktop without ever forcing a scroll.
 *
 * All motion is GPU-friendly and respects prefers-reduced-motion.
 */
export function LanguageStep({ onContinue }: { onContinue: () => void }) {
  const { locale, setLocale, t } = useI18n()
  const [selected, setSelected] = useState<Locale>(locale)

  function pick(next: Locale) {
    setSelected(next)
    setLocale(next)
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-[clamp(0.65rem,2.4vh,1.5rem)] text-center">
      {/* Cinematic hero — absorbs leftover height and scales down when short */}
      <div className="flex min-h-0 w-full flex-1 items-center justify-center pt-1">
        <LanguageGlobe />
      </div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="shrink-0"
      >
        <h1 className="flex items-center justify-center gap-2.5 text-[clamp(1.5rem,5.5vw,1.9rem)] font-extrabold leading-tight tracking-tight text-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-balance">{t("lang.selectTitle")}</span>
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        </h1>
        <p className="mt-1.5 text-sm font-medium tracking-[0.18em] text-muted-foreground/90">
          Select your language
        </p>
      </motion.div>

      {/* Language cards */}
      <div className="grid w-full shrink-0 grid-cols-2 gap-2.5">
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
                "glass group relative flex items-center gap-2.5 overflow-hidden rounded-2xl border px-3 py-3 text-start transition-colors duration-300",
                active
                  ? "border-primary/70 bg-primary/[0.07] scale-[1.02]"
                  : "border-border/60 hover:border-primary/45",
              )}
            >
              {/* Active glow + moving sheen */}
              {active && (
                <>
                  <span
                    aria-hidden
                    className="animate-glow pointer-events-none absolute -inset-px rounded-2xl bg-[radial-gradient(120%_120%_at_50%_0%,color-mix(in_oklch,var(--primary)_32%,transparent),transparent_70%)]"
                  />
                  <span className="sheen pointer-events-none absolute inset-0 rounded-2xl" />
                </>
              )}

              {/* 3D flag that ripples in the wind — active waves livelier */}
              <span
                aria-hidden
                className="relative flex h-11 w-11 shrink-0 items-center justify-center [perspective:340px]"
              >
                <span
                  className="animate-flag-wind relative block h-11 w-11"
                  style={{ animationDuration: active ? "2.4s" : "3.6s" }}
                >
                  <Image
                    src={FLAG[code] || "/placeholder.svg"}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.28)]"
                  />
                </span>
              </span>

              <span className="relative flex-1 text-[0.95rem] font-bold text-foreground">
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
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_60%,transparent)]"
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

      {/* Premium continue CTA with a continuous light sweep */}
      <motion.button
        type="button"
        onClick={onContinue}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 220, damping: 22 }}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.97 }}
        className="bg-gold elevate-gold relative flex w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-2xl py-[clamp(0.85rem,2vh,1.05rem)] text-base font-extrabold text-primary-foreground"
      >
        {/* moving light sweep */}
        <span
          aria-hidden
          className="cta-sweep pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-[linear-gradient(90deg,transparent,color-mix(in_oklch,white_55%,transparent),transparent)]"
        />
        <span className="relative z-[2]">{t("common.continue")}</span>
        <ChevronLeft className="relative z-[2] h-5 w-5" />
      </motion.button>

      {/* Trust badges with floating + glow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.5 }}
        className="flex w-full shrink-0 items-stretch justify-center pb-[max(0.25rem,env(safe-area-inset-bottom))]"
      >
        {TRUST.map((b, i) => (
          <div key={b.key} className="flex flex-1 items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.1, duration: 0.45 }}
              className="flex flex-col items-center gap-1 px-2 text-center"
            >
              <span
                className="animate-bubble flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20"
                style={{ animationDelay: `${i * 0.5}s` }}
              >
                <b.icon className="h-[1.05rem] w-[1.05rem] text-primary" aria-hidden />
              </span>
              <span className="text-[0.7rem] font-bold leading-tight text-foreground">{t(b.key)}</span>
              {locale !== "en" && (
                <span className="text-[0.6rem] leading-tight text-muted-foreground">{b.en}</span>
              )}
            </motion.div>
            {i < TRUST.length - 1 && <span className="h-10 w-px self-center bg-border/50" aria-hidden />}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

/** Display order chosen to match the reference layout (en, fa, hi, ru). */
const DISPLAY_ORDER: Locale[] = ["en", "fa", "hi", "ru"]

/** 3D rendered waving-flag image per locale. */
const FLAG: Record<Locale, string> = {
  fa: "/onboarding/flags/fa.png",
  en: "/onboarding/flags/en.png",
  ru: "/onboarding/flags/ru.png",
  hi: "/onboarding/flags/hi.png",
}

/** ISO country code shown as a small badge on each card. */
const COUNTRY_CODE: Record<Locale, string> = {
  fa: "IR",
  en: "GB",
  ru: "RU",
  hi: "IN",
}

/** Trust badges anchoring the foot of the screen (localized live via t()). */
const TRUST = [
  { icon: Shield, key: "trust.secure", en: "Secure & Safe" },
  { icon: Zap, key: "trust.fast", en: "Fast & Easy" },
  { icon: Headphones, key: "trust.support", en: "24/7 Support" },
] as const
