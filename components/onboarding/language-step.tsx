"use client"

import { useState } from "react"
import Image from "next/image"
import { motion } from "motion/react"
import { ChevronLeft } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/locales"
import { cn } from "@/lib/utils"

/** Mascot waves while the user picks their language. */
export function LanguageStep({ onContinue }: { onContinue: () => void }) {
  const { locale, setLocale } = useI18n()
  const [selected, setSelected] = useState<Locale>(locale)

  function pick(next: Locale) {
    setSelected(next)
    setLocale(next)
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 16 }}
        className="relative h-36 w-36"
      >
        <Image
          src="/onboarding/mascot-welcome.png"
          alt="مَسکات خوش‌آمدگویی"
          fill
          sizes="144px"
          className="object-contain drop-shadow-2xl"
          priority
        />
      </motion.div>

      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-foreground">
        زبان خود را انتخاب کنید
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Select your language</p>

      <div className="mt-8 grid w-full grid-cols-2 gap-3">
        {LOCALES.map((code, i) => (
          <motion.button
            key={code}
            type="button"
            onClick={() => pick(code)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, type: "spring", stiffness: 260, damping: 24 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "glass flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-right transition-colors",
              selected === code
                ? "border-primary/60 bg-primary/10"
                : "border-border/60 hover:border-primary/30",
            )}
          >
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/60 text-xl"
            >
              {FLAG[code]}
            </span>
            <span className="flex-1 text-sm font-bold text-foreground">{LOCALE_NAMES[code]}</span>
            <span
              className={cn(
                "h-4 w-4 rounded-full border-2 transition-colors",
                selected === code ? "border-primary bg-primary" : "border-muted-foreground/40",
              )}
            />
          </motion.button>
        ))}
      </div>

      <motion.button
        type="button"
        onClick={onContinue}
        whileTap={{ scale: 0.98 }}
        className="elevate-gold mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground"
      >
        ادامه
        <ChevronLeft className="h-5 w-5" />
      </motion.button>
    </div>
  )
}

/** Flag emoji per locale (kept local so the screen owns its visuals). */
const FLAG: Record<Locale, string> = {
  fa: "🇮🇷",
  en: "🇬🇧",
  ru: "🇷🇺",
  hi: "🇮🇳",
}
