"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Share2 } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * Immersive product hero. The cover image starts at the top of the screen and
 * fades ("محو") into the page background at the bottom via a gradient scrim, so
 * the title block below reads as a continuation of the image — matching the
 * approved mockups. Reused by both the shop and auction detail templates.
 *
 * Back / share / watch controls float over the image as circular glass buttons.
 * When no cover image exists we fall back to a themed monogram panel so the
 * layout never collapses.
 */
export function ProductHero({
  image,
  title,
  backHref,
  onShare,
  watchSlot,
  overlay,
  treatmentClass,
}: {
  image: string | null
  title: string
  backHref: string
  onShare?: () => void
  /** Optional watch/favourite control rendered top-start over the image. */
  watchSlot?: ReactNode
  /** Optional badges/stamp rendered bottom-start over the image. */
  overlay?: ReactNode
  /** Extra image filter (e.g. auction ended dimming). */
  treatmentClass?: string
}) {
  const { t } = useI18n()
  const monogram = title.trim().charAt(0).toUpperCase() || "?"

  return (
    <div className="relative -mx-4 -mt-4 web:lg:mx-0 web:lg:mt-0 web:lg:rounded-3xl web:lg:overflow-hidden">
      <div className="relative aspect-square w-full overflow-hidden sm:aspect-[16/10] web:lg:aspect-[16/9]">
        {image ? (
          <Image
            src={image || "/placeholder.svg"}
            alt={title}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 60vw"
            className={cn("object-cover", treatmentClass)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-secondary to-background">
            <span className="text-6xl font-black tracking-tight text-foreground/80">{monogram}</span>
          </div>
        )}

        {/* Fade the image into the page background at the bottom. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/10 to-background"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/60 to-transparent"
        />

        {/* Floating controls.
            RTL + justify-between: the first child sits on the RIGHT, the second
            on the LEFT. Back button goes right (start of the reading flow) and
            the like/share group goes left, per the approved layout. Top offset
            is at least 15px so the controls clear a phone status bar / notch. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 pt-[max(30px,calc(var(--tg-safe-top,0px)+15px))]">
          <Link
            href={backHref}
            aria-label={t("detail.back")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background/60 text-foreground backdrop-blur-md transition-colors hover:bg-background/80"
          >
            <ArrowRight className="h-[18px] w-[18px]" />
          </Link>
          <div className="flex items-center gap-2">
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                aria-label={t("detail.share")}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background/60 text-foreground backdrop-blur-md transition-colors hover:bg-background/80"
              >
                <Share2 className="h-[18px] w-[18px]" />
              </button>
            )}
            {watchSlot}
          </div>
        </div>

        {overlay && <div className="absolute bottom-4 left-3 flex items-center gap-2">{overlay}</div>}
      </div>
    </div>
  )
}

