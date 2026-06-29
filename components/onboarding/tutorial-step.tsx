"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  Compass,
  Wallet,
  ShoppingBag,
  Gavel,
  BellRing,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

type Slide = {
  icon: LucideIcon
  title: MessageKey
  body: MessageKey
}

/** Five-step guided tour of the marketplace, shown after language selection. */
const SLIDES: Slide[] = [
  { icon: Compass, title: "tour.s1.title", body: "tour.s1.body" },
  { icon: Wallet, title: "tour.s2.title", body: "tour.s2.body" },
  { icon: ShoppingBag, title: "tour.s3.title", body: "tour.s3.body" },
  { icon: Gavel, title: "tour.s4.title", body: "tour.s4.body" },
  { icon: BellRing, title: "tour.s5.title", body: "tour.s5.body" },
]

export function TutorialStep({
  onDone,
  onSkip,
}: {
  onDone: () => void
  onSkip: () => void
}) {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1
  const Icon = slide.icon

  function next() {
    if (isLast) onDone()
    else setIndex((i) => i + 1)
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Top bar: progress dots + skip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("tour.skip")}
        </button>
      </div>

      {/* Slide body */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center"
          >
            <span className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary/12 text-primary surface-glow">
              <Icon className="h-12 w-12" />
            </span>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {t("tour.step", { n: index + 1, total: SLIDES.length })}
            </p>
            <h2 className="text-balance text-2xl font-extrabold tracking-tight text-foreground">
              {t(slide.title)}
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
              {t(slide.body)}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.button
        type="button"
        onClick={next}
        whileTap={{ scale: 0.98 }}
        className="elevate-gold flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground"
      >
        {isLast ? t("tour.start") : t("tour.next")}
        <ChevronLeft className="h-5 w-5" />
      </motion.button>
    </div>
  )
}
