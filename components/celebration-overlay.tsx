"use client"

import { useEffect, useMemo } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Check, Gavel, ShoppingBag, Sparkles, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"

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

const config = {
  purchase: { icon: ShoppingBag, accent: "text-success", ring: "border-success/50 bg-success/10", button: "bg-success text-success-foreground hover:bg-success/90" },
  "auction-win": { icon: Gavel, accent: "text-primary", ring: "border-primary/50 bg-primary/10", button: "bg-primary text-primary-foreground hover:bg-primary/90" },
  "giveaway-entry": { icon: Check, accent: "text-success", ring: "border-success/50 bg-success/10", button: "bg-success text-success-foreground hover:bg-success/90" },
  "giveaway-win": { icon: Trophy, accent: "text-primary", ring: "border-primary/50 bg-primary/10", button: "bg-primary text-primary-foreground hover:bg-primary/90" },
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
  const variant = config[kind]
  const Icon = variant.icon
  const particles = useMemo(() => Array.from({ length: 14 }, (_, index) => ({
    id: index,
    angle: (index / 14) * Math.PI * 2,
    distance: 105 + (index % 3) * 24,
    delay: (index % 5) * 0.04,
  })), [])

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

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-overlay/95 px-4 py-[max(1rem,env(safe-area-inset-top))]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.12 : 0.35 }} role="dialog" aria-modal="true" aria-labelledby="celebration-title"
        >
          <motion.div className="celebration-beam" aria-hidden="true" initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1, rotate: reduced ? 0 : 10 }} transition={{ duration: reduced ? 0.15 : 0.9, ease: [0.22, 1, 0.36, 1] }} />
          {!reduced && particles.map((particle) => (
            <motion.span key={particle.id} className={cn("absolute size-1.5 rounded-full", particle.id % 3 === 0 ? "bg-success" : "bg-primary")}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], x: Math.cos(particle.angle) * particle.distance, y: Math.sin(particle.angle) * particle.distance, scale: [0, 1.3, 0] }}
              transition={{ duration: 1.1, delay: 0.25 + particle.delay, ease: "easeOut" }} aria-hidden="true" />
          ))}

          <motion.section className="relative flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-border bg-card p-6 text-center shadow-2xl"
            initial={{ opacity: 0, y: reduced ? 0 : 30, scale: reduced ? 1 : 0.88 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 24, delay: reduced ? 0 : 0.12 }}
          >
            <button type="button" onClick={onClose} className="absolute end-3 top-3 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label={language === "fa" ? "بستن" : "Close"}><X className="size-5" /></button>
            <motion.div className={cn("relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2", variant.ring)} animate={reduced ? undefined : { y: [0, -6, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
              {image ? <img src={image} alt="" className="absolute inset-0 size-full object-cover opacity-30" /> : null}
              <Icon className={cn("relative size-11", variant.accent)} strokeWidth={1.7} />
              <Sparkles className={cn("absolute end-2 top-2 size-4", variant.accent)} aria-hidden="true" />
            </motion.div>
            <div className="flex flex-col gap-2">
              <p className={cn("text-xs font-bold tracking-wide", variant.accent)}>{kind === "purchase" ? (language === "fa" ? "سفارش تایید شد" : "ORDER CONFIRMED") : language === "fa" ? "لحظه ویژه شما" : "YOUR MOMENT"}</p>
              <h2 id="celebration-title" className="text-balance text-2xl font-extrabold leading-tight text-card-foreground">{title}</h2>
              {subject ? <p dir="auto" className="text-pretty font-bold text-card-foreground">{subject}</p> : null}
              <p className="text-pretty text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            {actionHref ? (
              <a href={actionHref} className={cn("inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-bold transition-colors", variant.button)}>
                {action}
              </a>
            ) : (
              <Button onClick={onClose} className={cn("h-12 w-full rounded-2xl font-bold", variant.button)}>
                {action}
              </Button>
            )}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
