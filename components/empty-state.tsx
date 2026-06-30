"use client"

import Link from "next/link"
import { LogIn, type LucideIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"

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
  compact = false,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  /** Tighter padding + smaller icon for in-section/in-rail empties. */
  compact?: boolean
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
        "flex flex-col items-center justify-center text-center",
        compact
          ? "card-premium gap-3 rounded-2xl border border-dashed border-border/80 px-6 py-9"
          : "gap-4 px-6 py-14",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex items-center justify-center",
          compact ? "size-14" : "size-20",
        )}
      >
        {/* Soft accent halo behind the icon. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/12 blur-md"
        />
        <span
          className={cn(
            "relative flex items-center justify-center rounded-3xl border border-primary/20 bg-card/70 ring-1 ring-inset ring-foreground/5",
            compact ? "size-14" : "size-20",
          )}
        >
          <Icon
            className={cn("text-primary", compact ? "size-6" : "size-8")}
            strokeWidth={1.75}
          />
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
  description,
  className,
}: {
  description?: string
  className?: string
}) {
  const { t } = useI18n()
  return (
    <EmptyState
      icon={LogIn}
      title={t("signIn.title")}
      description={description ?? t("signIn.defaultDesc")}
      actionLabel={t("signIn.action")}
      actionHref="/login"
      className={className}
    />
  )
}
