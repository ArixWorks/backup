import { cn } from "@/lib/utils"

/**
 * SubIO brand lockup: a premium 3D gold store badge with an ambient gold-glow
 * halo + the English wordmark and a micro tagline. The name is always rendered
 * in Latin script ("SubIO") for a clean, modern, internationally legible
 * identity — never transliterated to Persian. Fully token-driven so it recolors
 * with the active theme; the glow pulse respects the motion tiers / reduce-motion.
 */
export function Logo({ className, showTagline = true }: { className?: string; showTagline?: boolean }) {
  return (
    <div dir="ltr" className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className="h-9 w-9" />
      <span className="flex flex-col">
        <span className="text-[1.3rem] font-extrabold leading-none tracking-tight">
          <span className="text-foreground">Sub</span>
          <span className="text-gold">IO</span>
        </span>
        {showTagline && (
          <span className="mt-1 text-[0.5rem] font-semibold uppercase leading-none tracking-[0.28em] text-muted-foreground">
            Marketplace
          </span>
        )}
      </span>
    </div>
  )
}

/**
 * Standalone 3D store/subscription badge mark. Built from layered token-driven
 * surfaces: an ambient gold glow halo, the cinematic `.bg-gold` gradient tile
 * with a gold ring + premium elevation, a glossy top-light highlight, and an
 * inner bottom shadow for real depth.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("group relative inline-flex shrink-0 items-center justify-center", className)} aria-hidden="true">
      {/* ambient gold glow halo (gentle pulse — honors motion tiers) */}
      <span
        className="animate-glow pointer-events-none absolute -inset-1.5 rounded-[1.4rem] blur-md"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 45%, color-mix(in oklch, var(--primary) 55%, transparent), transparent 70%)",
        }}
      />
      {/* the 3D tile */}
      <span className="bg-gold elevate-gold relative flex h-full w-full items-center justify-center rounded-2xl ring-1 ring-primary/50 transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:scale-[1.06]">
        {/* glossy top-light highlight */}
        <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/40 via-white/5 to-transparent" />
        {/* inner bottom shadow for depth */}
        <span className="pointer-events-none absolute inset-x-1.5 bottom-1 h-2 rounded-full bg-[oklch(0_0_0/0.28)] blur-[3px]" />
        <svg
          viewBox="0 0 24 24"
          className="relative h-5 w-5 text-primary-foreground drop-shadow-[0_1px_1px_oklch(0_0_0/0.35)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* shopping-bag body */}
          <path d="M5.5 8h13l-.9 10.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5.5 8Z" />
          {/* handle / subscription arc */}
          <path d="M8.75 8V6.5a3.25 3.25 0 0 1 6.5 0V8" />
        </svg>
      </span>
    </span>
  )
}
