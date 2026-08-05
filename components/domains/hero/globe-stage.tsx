"use client"

import dynamic from "next/dynamic"
import { useMotionTier } from "@/components/motion-provider"
import { TldPill } from "./domain-badge"

/** cobe plus a WebGL context is fetched only when it will actually be used. */
const GlobePulse = dynamic(() => import("./globe-pulse"), {
  ssr: false,
  loading: () => <div className="aspect-square w-full" aria-hidden="true" />,
})

/**
 * The hero globe: a real dotted-map sphere the user can spin.
 *
 * Drag with a mouse or swipe to rotate; the gesture tracks 1:1 and carries
 * momentum, and at rest the globe keeps a slow idle drift that pauses on hover
 * so a moving pill can still be clicked. The extension pills are projected onto
 * true marker coordinates, so they orbit with the sphere and fade as they pass
 * behind it while staying real <button>s - crisp, translatable and focusable.
 *
 * Colours are read from the live theme tokens, so the globe restyles itself
 * whenever the site theme changes rather than pinning one accent.
 */
export function GlobeStage({
  tlds,
  onSelectTld,
  selectLabel,
  caption,
  captionHint,
}: {
  tlds: string[]
  onSelectTld: (tld: string) => void
  selectLabel: string
  caption: string
  captionHint: string
}) {
  const tier = useMotionTier()
  const animated = tier !== "minimal"

  return (
    <div className="relative flex w-full flex-col items-center gap-4">
      {/* Stays modest on phones so the search field is still above the fold,
          then grows into the space the two-column desktop layout gives it. */}
      <div className="relative mx-auto w-full max-w-[17rem] sm:max-w-[21rem] lg:max-w-[26rem]">
        {/* Bloom behind the sphere so its glow has something to sit on. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 size-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl" />
        </div>

        {animated ? (
          <GlobePulse
            tlds={tlds}
            onSelectTld={onSelectTld}
            selectLabel={selectLabel}
            quality={tier === "cinematic" ? "cinematic" : "balanced"}
          />
        ) : (
          <StaticGlobe tlds={tlds} onSelectTld={onSelectTld} selectLabel={selectLabel} />
        )}
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <strong className="text-balance text-base font-bold md:text-lg">{caption}</strong>
        <span className="text-pretty text-xs text-muted-foreground md:text-sm">{captionHint}</span>
      </div>
    </div>
  )
}

/**
 * Reduced-motion fallback: same silhouette and the same interactive pills, but
 * a flat themed disc with no WebGL context, no download and no animation.
 */
function StaticGlobe({
  tlds,
  onSelectTld,
  selectLabel,
}: {
  tlds: string[]
  onSelectTld: (tld: string) => void
  selectLabel: string
}) {
  const items = tlds.slice(0, 5)

  return (
    <div className="relative aspect-square w-full">
      <div
        aria-hidden="true"
        className="absolute inset-[14%] rounded-full border border-primary/20 shadow-2xl shadow-primary/10"
        style={{
          background:
            "radial-gradient(circle at 34% 28%, color-mix(in oklab, var(--primary) 26%, transparent), transparent 58%), radial-gradient(circle at 50% 50%, var(--card), var(--background))",
        }}
      />
      {items.map((tld, index) => {
        // Even ring, starting at the top.
        const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2
        return (
          <div
            key={tld}
            className="absolute top-1/2 left-1/2"
            style={{
              transform: `translate(-50%, -50%) translate(${(Math.cos(angle) * 42).toFixed(2)}%, ${(Math.sin(angle) * 42).toFixed(2)}%)`,
            }}
          >
            <TldPill tld={tld} selectLabel={selectLabel} onSelect={onSelectTld} pulse={false} />
          </div>
        )
      })}
    </div>
  )
}
