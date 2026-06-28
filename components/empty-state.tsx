"use client"

import Link from "next/link"
import { LogIn, type LucideIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * The single, canonical empty state for the whole platform. Every "nothing
 * here yet" screen (orders, watchlist, notifications, search, etc.) should use
 * this so the friendly-guidance pattern — soft haloed icon, balanced title,
 * one-line explanation, optional primary action — reads identically everywhere.
 *
 * Pass either `action` (a ready node) or the `actionLabel` + (`actionHref` |
 * `onAction`) shorthand for the standard primary CTA.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  actionHref,
  onAction,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
}) {
  const reduce = useReducedMotion()

  const cta =
    action ??
    (actionLabel
      ? actionHref
        ? (
            <Button size="lg" render={<Link href={actionHref} />}>
              {actionLabel}
            </Button>
          )
        : (
            <Button size="lg" onClick={onAction}>
              {actionLabel}
            </Button>
          )
      : null)

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="relative flex size-20 items-center justify-center">
        {/* Soft accent halo behind the icon. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/12 blur-md"
        />
        <span className="relative flex size-20 items-center justify-center rounded-3xl border border-primary/20 bg-card/70 ring-1 ring-inset ring-foreground/5">
          <Icon className="size-8 text-primary" strokeWidth={1.75} />
        </span>
      </div>

      <div className="flex max-w-xs flex-col gap-1.5">
        <h3 className="text-pretty font-heading text-base font-semibold leading-snug">
          {title}
        </h3>
        {description && (
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {cta && <div className="pt-1">{cta}</div>}
    </motion.div>
  )
}

/**
 * Canonical "you need an account" state, shared by every auth-gated page
 * (wallet, orders, notifications, support, reports, …). Wraps EmptyState so the
 * sign-in prompt looks identical platform-wide and always offers a way in.
 */
export function SignInRequired({
  description = "برای ادامه، ابتدا وارد حساب کاربری خود شوید.",
  className,
}: {
  description?: string
  className?: string
}) {
  return (
    <EmptyState
      icon={LogIn}
      title="ورود لازم است"
      description={description}
      actionLabel="ورود به حساب"
      actionHref="/login"
      className={className}
    />
  )
}
