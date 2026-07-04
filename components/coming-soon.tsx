"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Sparkles } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { FadeItem, Stagger } from "@/components/motion"

/**
 * Premium "coming soon" placeholder for services that are announced but not yet
 * implemented (VPS, Domains, …). Keeps a single, elegant entry point instead of
 * an empty page so the information architecture stays complete.
 */
export function ComingSoon({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
}) {
  const { t } = useI18n()

  return (
    <Stagger className="flex min-h-[70dvh] flex-col items-center justify-center px-2 text-center">
      <FadeItem>
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
          {/* Ambient halo */}
          <span
            aria-hidden
            className="animate-float absolute inset-0 rounded-full bg-primary/15 blur-2xl"
          />
          <span className="gold-border sheen relative flex h-24 w-24 items-center justify-center rounded-3xl bg-secondary/60">
            <Icon className="h-10 w-10 text-primary" strokeWidth={1.8} aria-hidden />
          </span>
        </div>
      </FadeItem>

      <FadeItem>
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-gold">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t("badge.soon")}
        </span>
      </FadeItem>

      <FadeItem>
        <h1 className="text-balance text-2xl font-extrabold">{title}</h1>
      </FadeItem>

      <FadeItem>
        <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
        <p className="mt-4 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          {t("soon.body")}
        </p>
      </FadeItem>

      <FadeItem>
        <Button variant="gold" size="lg" className="mt-7" render={<Link href="/" />}>
          {t("soon.back")}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </FadeItem>
    </Stagger>
  )
}
