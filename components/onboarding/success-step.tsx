"use client"

import { motion } from "motion/react"
import { Check, Loader2 } from "lucide-react"

/** Final onboarding screen — celebratory check + enter the store. */
export function SuccessStep({
  busy,
  onStart,
}: {
  busy: boolean
  onStart: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="relative flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500 text-white"
        style={{ boxShadow: "0 18px 50px -12px color-mix(in oklch, var(--success) 60%, transparent)" }}
      >
        <motion.span
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.18, type: "spring", stiffness: 260, damping: 16 }}
        >
          <Check className="h-14 w-14" strokeWidth={3} />
        </motion.span>
        {/* Pulsing ring */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-emerald-400"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-7 text-3xl font-extrabold tracking-tight text-foreground"
      >
        همه‌چیز آماده است!
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
        className="mx-auto mt-2 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground"
      >
        تمام شد. از فروشگاه لذت ببرید — شارژ کنید، خرید کنید، تمام.
      </motion.p>

      <motion.button
        type="button"
        onClick={onStart}
        disabled={busy}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.46 }}
        className="elevate-gold mt-9 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "شروع خرید"}
      </motion.button>
    </div>
  )
}
