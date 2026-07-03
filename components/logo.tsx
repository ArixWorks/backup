import { cn } from "@/lib/utils"

/**
 * SubIO brand lockup: a gold gradient subscription-bag badge + the English
 * wordmark with a small uppercase caption. The two-line wordmark is centered
 * against the badge so the mark and title share one balanced optical baseline
 * (a single line of Vazirmatn Latin glyphs otherwise floats above center).
 * The name is always rendered in Latin script ("SubIO") for a clean, modern,
 * internationally legible identity — never transliterated to Persian.
 */
export function Logo({ className }: { className?: string }) {
  return (
    // No forced direction: the lockup follows the page direction, so the badge
    // sits on the reading-start side (right in RTL/Persian, left in LTR/English)
    // while the wordmark keeps its Latin glyphs rendering left-to-right.
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className="h-9 w-9 shrink-0" />
      <span className="flex flex-col justify-center items-start text-start leading-none">
        <span dir="ltr" className="text-[1.3rem] font-extrabold leading-[1.05] tracking-tight">
          <span className="text-foreground">Sub</span>
          <span className="text-gold">IO</span>
        </span>
        <span
          dir="ltr"
          className="mt-[0.15em] text-[0.5rem] font-semibold uppercase leading-none tracking-[0.26em] text-muted-foreground"
        >
          Marketplace
        </span>
      </span>
    </div>
  )
}

/** Standalone subscription-bag badge mark (gold gradient tile). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-gold elevate-gold relative inline-flex items-center justify-center rounded-[0.85rem] ring-1 ring-primary/40",
        className,
      )}
      aria-hidden="true"
    >
      {/* glossy top-light highlight */}
      <span className="pointer-events-none absolute inset-0 rounded-[0.85rem] bg-gradient-to-b from-white/35 via-white/5 to-transparent" />
      {/* subtle inner ring for depth */}
      <span className="pointer-events-none absolute inset-[1.5px] rounded-[0.7rem] ring-1 ring-inset ring-white/10" />
      <svg
        viewBox="0 0 24 24"
        className="relative h-[1.15rem] w-[1.15rem] text-primary-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* shopping-bag body */}
        <path d="M5.4 8.2h13.2l-.85 9.7a2.1 2.1 0 0 1-2.1 1.9H8.35a2.1 2.1 0 0 1-2.1-1.9L5.4 8.2Z" />
        {/* handle / subscription arc */}
        <path d="M8.75 8.2V6.6a3.25 3.25 0 0 1 6.5 0v1.6" />
        {/* subscription check accent inside the bag */}
        <path d="M9.6 13.4l1.7 1.7 3.1-3.3" />
      </svg>
    </span>
  )
}
