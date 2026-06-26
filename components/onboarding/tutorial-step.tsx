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

type Slide = {
  icon: LucideIcon
  title: string
  body: string
}

/** Five-step guided tour of the marketplace, shown after language selection. */
const SLIDES: Slide[] = [
  {
    icon: Compass,
    title: "به فروشگاه خوش آمدید",
    body: "محصولات دیجیتال، حساب‌ها و کلیدها را مرور کنید. همه‌چیز مرتب و دسته‌بندی‌شده است.",
  },
  {
    icon: Wallet,
    title: "موجودی خود را شارژ کنید",
    body: "با کیف پول، ارز دیجیتال یا درگاه، موجودی اضافه کنید و سریع‌تر خرید کنید.",
  },
  {
    icon: ShoppingBag,
    title: "خرید محصول",
    body: "روی هر محصول بزنید تا جزئیات را ببینید و پرداخت کنید. تحویل آنی همین‌جا انجام می‌شود.",
  },
  {
    icon: Gavel,
    title: "در مزایده‌ها شرکت کنید",
    body: "روی محصولات ویژه پیشنهاد بدهید و با بهترین قیمت برنده شوید — یک امکان منحصربه‌فرد.",
  },
  {
    icon: BellRing,
    title: "هیچ‌چیز را از دست ندهید",
    body: "برای موجودی مجدد و قرعه‌کشی‌ها اعلان دریافت کنید و همیشه یک قدم جلوتر باشید.",
  },
]

export function TutorialStep({
  onDone,
  onSkip,
}: {
  onDone: () => void
  onSkip: () => void
}) {
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
          رد کردن
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
              مرحله {index + 1} از {SLIDES.length}
            </p>
            <h2 className="text-balance text-2xl font-extrabold tracking-tight text-foreground">
              {slide.title}
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
              {slide.body}
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
        {isLast ? "بزن بریم" : "بعدی"}
        <ChevronLeft className="h-5 w-5" />
      </motion.button>
    </div>
  )
}
