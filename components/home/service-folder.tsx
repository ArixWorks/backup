"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, Lock } from "lucide-react"
import { useMotionTier } from "@/components/motion-provider"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"
import type { HomePreviewItem } from "@/lib/home/service-previews"

/**
 * One home service rendered as a 3D folder that opens to reveal up to three
 * real items from that service.
 *
 * Interaction is split by input capability rather than by screen size:
 *  - pointer devices open the folder on hover (and on keyboard focus, so the
 *    reveal is reachable without a mouse);
 *  - touch devices have no hover, so the first tap opens the folder and the
 *    second tap follows through to the service page. A hint line tells the user
 *    which of the two states they are in.
 *
 * The whole-card link is an absolutely positioned overlay rather than a wrapper
 * so the preview cards — which are links themselves — can sit above it without
 * nesting anchors.
 */

/** Accent token driving a folder's tint. Constrained to the existing palette. */
type Accent = "primary" | "accent" | "success" | "warning"

export type ServiceFolderDef = {
  href: string
  title: MessageKey
  desc: MessageKey
  /** Monospace network label under the title, matching the site's tech voice. */
  code: string
  accent: Accent
  /** Renders the closed, locked folder regardless of items (used by "soon"). */
  locked?: boolean
}

/**
 * Per-accent class sets. Written out literally instead of composed from
 * template strings so Tailwind can see every class at build time.
 */
const ACCENTS: Record<Accent, { tint: string; ring: string; text: string; glow: string; layerBack: string; layerTab: string; layerFront: string }> = {
  primary: {
    tint: "bg-primary/[0.07]",
    ring: "hoverable:group-hover:border-primary/45",
    text: "text-primary",
    glow: "hoverable:group-hover:shadow-[0_22px_50px_-28px_color-mix(in_oklab,var(--primary)_75%,transparent)]",
    layerBack: "bg-[color-mix(in_oklab,var(--primary)_22%,var(--card))]",
    layerTab: "bg-[color-mix(in_oklab,var(--primary)_30%,var(--card))]",
    layerFront: "bg-[color-mix(in_oklab,var(--primary)_38%,var(--card))]",
  },
  accent: {
    tint: "bg-accent/[0.07]",
    ring: "hoverable:group-hover:border-accent/45",
    text: "text-accent",
    glow: "hoverable:group-hover:shadow-[0_22px_50px_-28px_color-mix(in_oklab,var(--accent)_75%,transparent)]",
    layerBack: "bg-[color-mix(in_oklab,var(--accent)_22%,var(--card))]",
    layerTab: "bg-[color-mix(in_oklab,var(--accent)_30%,var(--card))]",
    layerFront: "bg-[color-mix(in_oklab,var(--accent)_38%,var(--card))]",
  },
  success: {
    tint: "bg-success/[0.07]",
    ring: "hoverable:group-hover:border-success/45",
    text: "text-success",
    glow: "hoverable:group-hover:shadow-[0_22px_50px_-28px_color-mix(in_oklab,var(--success)_75%,transparent)]",
    layerBack: "bg-[color-mix(in_oklab,var(--success)_22%,var(--card))]",
    layerTab: "bg-[color-mix(in_oklab,var(--success)_30%,var(--card))]",
    layerFront: "bg-[color-mix(in_oklab,var(--success)_38%,var(--card))]",
  },
  warning: {
    tint: "bg-warning/[0.07]",
    ring: "hoverable:group-hover:border-warning/45",
    text: "text-warning",
    glow: "hoverable:group-hover:shadow-[0_22px_50px_-28px_color-mix(in_oklab,var(--warning)_75%,transparent)]",
    layerBack: "bg-[color-mix(in_oklab,var(--warning)_22%,var(--card))]",
    layerTab: "bg-[color-mix(in_oklab,var(--warning)_30%,var(--card))]",
    layerFront: "bg-[color-mix(in_oklab,var(--warning)_38%,var(--card))]",
  },
}

/**
 * Shared timing for the whole opening gesture. A single long duration on a
 * decelerating curve is what makes the folder read as unfolding rather than
 * switching: every layer and every card runs the same curve, so the flap, the
 * tab and the fan stay one motion instead of three.
 *
 * Deliberately NOT the reference's `cubic-bezier(0.16,1,0.3,1)`. That curve
 * front-loads ~80% of the travel into its first quarter, so even at 780ms the
 * cards appeared to arrive at once and then spent the rest of the duration
 * invisibly creeping the last few pixels — which is exactly the "opens
 * instantly" feel being fixed here. This curve eases in before it decelerates,
 * spreading the movement across the full duration so the unfold is readable.
 */
const EASE = "cubic-bezier(0.32,0.08,0.24,1)"
const OPEN_MS = 820
/** Closing is quicker than opening, so leaving a folder never feels sticky. */
const CLOSE_MS = 420
/** Per-card offset, so the fan peels open one card at a time. */
const STAGGER_MS = 110

/** Fan geometry for a preview card: spread evenly around the folder centre. */
function fanTransform(index: number, total: number, open: boolean, reduceMotion: boolean) {
  // Closed cards collapse to 40% at the folder mouth, behind the front flap.
  // Starting small and travelling ~46px gives the reveal something to ease
  // through; a nearly-full-size start would arrive before the eye tracks it.
  //
  // `reduceMotion` pins them to the open geometry in both states. Only opacity
  // is transitioned in that mode, so a collapsed closed position would have the
  // cards teleport across the fan the instant they became visible — more
  // jarring than the animation someone opted out of.
  if (!open && !reduceMotion) return "translate3d(0,8px,0) rotate(0deg) scale(0.4)"
  const middle = (total - 1) / 2
  const factor = total > 1 ? (index - middle) / Math.max(middle, 1) : 0
  const rotate = factor * 23
  const x = factor * 57
  const y = -60 + Math.abs(factor) * 11
  return `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(1)`
}

function PreviewCard({
  item,
  index,
  total,
  open,
  accent,
  reduceMotion,
}: {
  item: HomePreviewItem
  index: number
  total: number
  open: boolean
  accent: Accent
  reduceMotion: boolean
}) {
  const { priceCompact } = useI18n()
  const a = ACCENTS[accent]

  // «۱٫۱ میلیون» rather than «۱٫۱۴۱ میلیون تومان» — one decimal is all this card
  // has room for, and "تومان" is implied. USD locales already come back as a
  // self-contained "$11.4" with an empty suffix, so they pass through unchanged.
  const compactLabel = (amount: string) => {
    const { value, suffix } = priceCompact(amount)
    const magnitude = suffix.replace(/\s*تومان\s*$/, "").trim()
    // `\d` is ASCII-only, so the digit class has to spell out Persian (U+06F0-9)
    // and Arabic-Indic (U+0660-9) digits for «۱٫۱۴۱» to become «۱٫۱».
    const short = value.replace(/([٫.][\d\u06F0-\u06F9\u0660-\u0669])[\d\u06F0-\u06F9\u0660-\u0669]+/, "$1")
    return magnitude ? `${short} ${magnitude}` : short
  }

  return (
    <Link
      href={item.href}
      // Hidden from the tab order and from assistive tech while closed: the
      // folder's own link already covers the service, and a stack of invisible
      // links would otherwise be four extra tab stops per card.
      tabIndex={open ? 0 : -1}
      aria-hidden={!open}
      className={cn(
        "group/card absolute -left-[34px] -top-[46px] h-[86px] w-[68px] outline-none",
        a.text,
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      style={{
        transform: fanTransform(index, total, open, reduceMotion),
        zIndex: 20 + index,
        // Opacity deliberately shares the transform's duration, curve AND
        // delay. Fading faster than the card travels was what made the reveal
        // feel abrupt: the card was fully opaque a third of the way through its
        // path, so the eye read it as appearing and then sliding.
        // Opening staggers outward from the first card and runs long; closing
        // drops the stagger and runs short, so the fan gathers back up as one
        // piece the moment the pointer leaves.
        transition: reduceMotion
          ? "opacity 150ms linear"
          : open
            ? `transform ${OPEN_MS}ms ${EASE} ${index * STAGGER_MS}ms, opacity ${OPEN_MS}ms ${EASE} ${index * STAGGER_MS}ms`
            : `transform ${CLOSE_MS}ms ${EASE}, opacity ${CLOSE_MS}ms ${EASE}`,
      }}
    >
      {/*
        Inner surface owns every visual and the hover lift. The hover transform
        has to live on its own element: the fan transform above is an inline
        style, which outranks any `hover:scale-*` utility on the same node, so a
        combined element would silently never grow.
      */}
      <span
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
          // Shorter than the unfold on purpose: this is the pointer-follow lift,
          // which should feel immediate, but it shares the unfold's curve so the
          // two motions look like they belong to the same object.
          "transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.32,0.08,0.24,1)]",
          "hoverable:group-hover/card:-translate-y-3 hoverable:group-hover/card:scale-115 hoverable:group-hover/card:border-current",
          "group-focus-visible/card:ring-2 group-focus-visible/card:ring-ring",
        )}
      >
      {item.image ? (
        <Image src={item.image} alt={item.label} fill sizes="80px" className="object-cover" />
      ) : (
        // Domains have no artwork, so the extension itself is the visual.
        <span className={cn("flex h-full w-full items-center justify-center px-1", a.tint)}>
          <span dir="ltr" className="truncate font-mono text-[13px] font-black tracking-tight text-foreground">
            {item.label}
          </span>
        </span>
      )}

      <span aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,color-mix(in_oklab,var(--background)_92%,transparent),transparent_62%)]" />

      <span className="absolute inset-x-1 bottom-1 flex flex-col gap-px">
        {item.image ? (
          <span dir="auto" className="truncate text-[8px] font-bold leading-3 text-foreground">
            {item.label}
          </span>
        ) : null}
        {/*
          Compact, not the full price: a 68px card truncates
          «۱٬۱۴۱٬۰۰۰ تومان» down to «۱٬۱۴۱…», which reads as a far smaller
          number than it is. The magnitude word carries the scale instead, and
          the unit is dropped because every price on the page is in Toman.
        */}
        {item.priceIrt ? (
          <span dir="auto" className="truncate text-[8px] font-extrabold leading-3 text-current">
            {compactLabel(item.priceIrt)}
          </span>
        ) : null}
      </span>
      </span>
    </Link>
  )
}

export function ServiceFolder({
  service,
  items,
  index,
}: {
  service: ServiceFolderDef
  items: HomePreviewItem[]
  index: number
}) {
  const { t, num } = useI18n()
  /**
   * The site-wide motion tier, not the raw OS flag. This matters here: the
   * provider lets someone explicitly choose Cinematic in settings and have that
   * beat their OS "Reduce Motion" default, and reading the OS media query
   * directly would silently ignore that opt-in and flatten the folder.
   */
  const reduceMotion = useMotionTier() === "minimal"
  const [open, setOpen] = useState(false)
  /**
   * `null` until measured. Anything that isn't a true hover device (phones,
   * tablets, the Telegram Mini App shell) gets the two-tap flow.
   */
  const [canHover, setCanHover] = useState<boolean | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  /**
   * Whether the folder was already open when the current tap *started*.
   *
   * Reading `open` directly in the click handler is not safe: tapping a link
   * focuses it on `pointerdown`, and focus-to-open would flip `open` to true
   * before `click` ever fires — so the "already open, let it navigate" branch
   * would win on the very first tap and the reveal would never be seen. This
   * ref is sampled before any of that can happen.
   */
  const openAtTapStartRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)")
    const sync = () => setCanHover(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const hasItems = items.length > 0 && !service.locked
  const isOpen = hasItems && open

  // Tapping elsewhere closes an opened folder on touch, so two folders can't
  // both sit open and overlap each other's fanned cards.
  useEffect(() => {
    if (!isOpen || canHover !== false) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    return () => document.removeEventListener("pointerdown", onDown)
  }, [isOpen, canHover])

  /**
   * On touch the first tap only opens the folder; we swallow the navigation so
   * the reveal is actually reachable. Once open, the tap goes through.
   */
  const onOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (canHover !== false || !hasItems || openAtTapStartRef.current) return
      e.preventDefault()
      setOpen(true)
    },
    [canHover, hasItems],
  )

  const a = ACCENTS[service.accent]
  // Every folder layer shares one transition string so the flap, tab and sheen
  // stay a single hinge movement, and all of them close at the faster rate.
  const flapTransition = `transform ${isOpen ? OPEN_MS : CLOSE_MS}ms ${EASE}`

  return (
    <article
      ref={rootRef}
      className={cn(
        "service-node group relative flex h-full min-h-64 flex-col items-center justify-end overflow-hidden rounded-[1.4rem] border border-border px-4 pb-4 pt-7",
        // Shares the fan's curve and duration so the tile's own lift settles
        // with the unfold instead of finishing first.
        "transition-[border-color,box-shadow,transform] duration-[820ms] ease-[cubic-bezier(0.32,0.08,0.24,1)]",
        a.ring,
        a.glow,
        "hoverable:hover:-translate-y-1 hoverable:hover:scale-[1.02]",
      )}
      style={{ perspective: "1000px" }}
      onMouseEnter={() => canHover && hasItems && setOpen(true)}
      onMouseLeave={() => canHover && setOpen(false)}
    >
      <span aria-hidden className="service-node__grid" />
      <span aria-hidden className="service-node__beam" />

      {/* Whole-card link. Sits under the preview cards so both stay clickable. */}
      <Link
        href={service.href}
        // Sampled before focus can run, so the click handler below sees the
        // state as it was when the user started this tap.
        onPointerDown={() => {
          openAtTapStartRef.current = open
        }}
        onClick={onOverlayClick}
        // Focus opens the folder for keyboard users only. On touch, focus lands
        // on pointerdown as part of the tap itself, so letting it open here
        // would make the first tap satisfy the "already open" branch and jump
        // straight to the service page.
        onFocus={() => canHover !== false && hasItems && setOpen(true)}
        onBlur={() => canHover !== false && setOpen(false)}
        aria-label={t(service.title)}
        className="absolute inset-0 z-10 rounded-[1.4rem] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {/* Folder + fan stage */}
      <div aria-hidden className="pointer-events-none relative mb-1 h-32 w-full shrink-0">
        {/* Back panel */}
        <span
          className={cn("absolute left-1/2 top-12 h-[74px] w-[108px] -translate-x-1/2 rounded-lg border border-border shadow-md", a.layerBack)}
          style={{
            transformOrigin: "bottom center",
            transform: isOpen && !reduceMotion ? "rotateX(-18deg) scaleY(1.04)" : "rotateX(0deg)",
            transition: flapTransition,
          }}
        />
        {/* Tab */}
        <span
          className={cn("absolute top-[38px] h-4 w-11 rounded-t-md border-x border-t border-border", a.layerTab)}
          style={{
            left: "calc(50% - 54px + 14px)",
            transformOrigin: "bottom center",
            transform: isOpen && !reduceMotion ? "rotateX(-28deg) translateY(-3px)" : "rotateX(0deg)",
            transition: flapTransition,
          }}
        />

        {/* Fanned preview cards, centred on the folder mouth. */}
        <div className="pointer-events-auto absolute left-1/2 top-[74px] z-20 size-0">
          {hasItems
            ? items.map((item, i) => (
                <PreviewCard
                  key={item.id}
                  item={item}
                  index={i}
                  total={items.length}
                  open={isOpen}
                  accent={service.accent}
                  reduceMotion={reduceMotion}
                />
              ))
            : null}
        </div>

        {/* Front flap — tips forward to let the cards out. */}
        <span
          className={cn("absolute left-1/2 top-[54px] z-30 h-[70px] w-[108px] -translate-x-1/2 rounded-lg border border-border shadow-lg", a.layerFront)}
          style={{
            transformOrigin: "bottom center",
            transform: isOpen && !reduceMotion ? "rotateX(34deg) translateY(10px)" : "rotateX(0deg)",
            transition: flapTransition,
          }}
        />
        {/* Sheen on the flap, so the fold reads as a physical edge. */}
        <span
          className="absolute left-1/2 top-[54px] h-[70px] w-[108px] -translate-x-1/2 rounded-lg bg-[linear-gradient(140deg,color-mix(in_oklab,var(--foreground)_16%,transparent),transparent_58%)]"
          style={{
            zIndex: 31,
            transformOrigin: "bottom center",
            transform: isOpen && !reduceMotion ? "rotateX(34deg) translateY(10px)" : "rotateX(0deg)",
            transition: flapTransition,
          }}
        />

        {/* Locked / empty marker sits on the closed flap. */}
        {!hasItems ? (
          <span className={cn("absolute left-1/2 top-[74px] z-40 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card", a.text)}>
            <Lock className="size-3.5" />
          </span>
        ) : null}
      </div>

      {/* Label block */}
      <div className="relative z-10 w-full text-center">
        <div className="flex items-center justify-center gap-1.5">
          <h3 dir="auto" className="text-pretty text-[15px] font-extrabold leading-6 text-foreground">
            {t(service.title)}
          </h3>
          <ChevronLeft className={cn("size-4 shrink-0 transition-transform duration-500 rtl:rotate-180", a.text, isOpen && "-translate-x-1 rtl:translate-x-1")} />
        </div>
        <p dir="auto" className="mt-0.5 line-clamp-2 text-pretty text-[11px] leading-4 text-muted-foreground">
          {t(service.desc)}
        </p>

        <div className="mt-2 flex items-center justify-center gap-2">
          <span aria-hidden className={cn("font-mono text-[8px] font-semibold tracking-[0.2em]", a.text, "opacity-60")}>
            {service.code}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold",
              hasItems ? "border-success/25 bg-success/[0.09] text-success" : "border-border text-muted-foreground",
            )}
          >
            {hasItems ? (
              <>
                <span className="size-1.5 rounded-full bg-success shadow-[0_0_7px_color-mix(in_oklab,var(--success)_80%,transparent)]" />
                {t("home.serviceItems", { count: num(items.length) })}
              </>
            ) : (
              t("badge.soon")
            )}
          </span>
        </div>

        {/* State hint: only meaningful on touch, where the reveal costs a tap. */}
        <p
          className={cn(
            "mt-1.5 h-3.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 transition-opacity duration-300",
            canHover === false && hasItems ? "opacity-100" : "opacity-0",
          )}
        >
          {isOpen ? t("common.viewAll") : t("home.serviceTapHint")}
        </p>
      </div>

      <span
        aria-hidden
        className={cn("pointer-events-none absolute inset-x-8 bottom-0 h-24 rounded-full blur-2xl transition-opacity duration-700", a.tint, isOpen ? "opacity-100" : "opacity-0")}
        style={{ animationDelay: `${index * 60}ms` }}
      />
    </article>
  )
}
