import { cn } from "@/lib/utils"

/**
 * SubIO brand lockup: a premium 3D gold gem mark + the English wordmark.
 * The name is always rendered in Latin script ("SubIO") for a clean, modern,
 * internationally legible identity — never transliterated to Persian.
 *
 * `size` scales the whole lockup (mark + wordmark) coherently; `animated`
 * enables the ambient micro-motion on the mark (orbital ring + float + sheen),
 * which is automatically silenced on lower motion tiers / reduced-motion via
 * the project's global motion classes.
 */
export function Logo({
  className,
  size = "md",
  animated = false,
}: {
  className?: string
  size?: "sm" | "md" | "lg"
  animated?: boolean
}) {
  const mark = { sm: "h-8 w-8", md: "h-9 w-9", lg: "h-12 w-12" }[size]
  const word = { sm: "text-lg", md: "text-[1.35rem]", lg: "text-3xl" }[size]
  // In the header (md) the wordmark hides on the very narrowest phones so the
  // centred lockup never collides with the side clusters — the 3D mark always
  // stands in as the brand. sm/lg always show the full wordmark.
  const wordVisibility = size === "md" ? "hidden min-[384px]:inline-flex" : "inline-flex"

  return (
    <div dir="ltr" className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className={mark} animated={animated} />
      <span className={cn("font-extrabold leading-none tracking-tight", word, wordVisibility)}>
        <span className="text-foreground">Sub</span>
        <span className="text-gold">IO</span>
      </span>
    </div>
  )
}

/**
 * Standalone SubIO gem mark: a faceted 3D gold hexagon badge with a sculpted
 * "S", a glossy top highlight, an ambient gold glow, and (optionally) a slowly
 * orbiting particle ring. Built entirely from gradients + the project's
 * cinematic utilities so it stays crisp at any size and theme-aware.
 */
export function BrandMark({
  className,
  animated = false,
}: {
  className?: string
  animated?: boolean
}) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      aria-hidden="true"
    >
      {/* Ambient gold glow halo behind the badge. */}
      <span
        className={cn(
          "pointer-events-none absolute -inset-1.5 rounded-full blur-md",
          "bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_55%,transparent)_0%,transparent_70%)]",
          animated && "animate-glow",
        )}
      />

      {/* Orbital ring + particle (premium micro-motion, paused on low tiers). */}
      {animated && (
        <svg
          viewBox="0 0 100 100"
          className="animate-orbit pointer-events-none absolute -inset-[18%] h-[136%] w-[136%] opacity-70"
          fill="none"
        >
          <ellipse
            cx="50"
            cy="50"
            rx="46"
            ry="20"
            transform="rotate(-28 50 50)"
            stroke="color-mix(in oklch, var(--primary) 45%, transparent)"
            strokeWidth="1.4"
          />
          <circle cx="92" cy="38" r="3.2" fill="var(--primary)" transform="rotate(-28 50 50)" />
          <circle cx="8" cy="62" r="2.2" fill="color-mix(in oklch, var(--primary) 70%, transparent)" transform="rotate(-28 50 50)" />
        </svg>
      )}

      {/* The faceted gem badge. */}
      <span
        className={cn(
          "elevate-gold relative inline-flex h-full w-full items-center justify-center",
          animated && "sheen animate-float",
        )}
        style={{ clipPath: "polygon(50% 0%, 95% 27%, 95% 73%, 50% 100%, 5% 73%, 5% 27%)" }}
      >
        <svg viewBox="0 0 48 48" className="h-full w-full">
          <defs>
            <linearGradient id="subio-face" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--gold-2)" />
              <stop offset="45%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--gold-deep)" />
            </linearGradient>
            <linearGradient id="subio-gloss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(1 0 0 / 0.45)" />
              <stop offset="55%" stopColor="oklch(1 0 0 / 0)" />
            </linearGradient>
          </defs>

          {/* hexagon face */}
          <polygon points="24,1 45.5,13 45.5,35 24,47 2.5,35 2.5,13" fill="url(#subio-face)" />
          {/* top gloss highlight */}
          <polygon points="24,1 45.5,13 45.5,24 24,12 2.5,24 2.5,13" fill="url(#subio-gloss)" />
          {/* inner bevel hairline */}
          <polygon
            points="24,1 45.5,13 45.5,35 24,47 2.5,35 2.5,13"
            fill="none"
            stroke="oklch(1 0 0 / 0.25)"
            strokeWidth="0.8"
          />

          {/* sculpted "S": dark drop, then light face for an embossed feel */}
          <g
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.6"
            transform="translate(0,0.6)"
          >
            <path
              d="M31 17.5c0-3.2-3.2-5-7-5s-7 1.9-7 4.9c0 3 2.8 4.1 7 5 4.6 1 7.2 2.2 7.2 5.6 0 3.3-3.4 5.2-7.4 5.2s-7.1-1.9-7.1-5"
              stroke="var(--gold-deep)"
              opacity="0.55"
              transform="translate(0,1.1)"
            />
            <path
              d="M31 17.5c0-3.2-3.2-5-7-5s-7 1.9-7 4.9c0 3 2.8 4.1 7 5 4.6 1 7.2 2.2 7.2 5.6 0 3.3-3.4 5.2-7.4 5.2s-7.1-1.9-7.1-5"
              stroke="var(--primary-foreground)"
            />
          </g>
        </svg>
      </span>
    </span>
  )
}
