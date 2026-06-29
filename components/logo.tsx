import { cn } from "@/lib/utils"

/**
 * SubIO brand lockup: a gold gradient store badge + the English wordmark.
 * The name is always rendered in Latin script ("SubIO") for a clean, modern,
 * internationally legible identity — never transliterated to Persian.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div dir="ltr" className={cn("flex items-center gap-2.5", className)}>
      <BrandMark className="h-9 w-9" />
      <span className="text-[1.35rem] font-extrabold leading-none tracking-tight">
        <span className="text-foreground">Sub</span>
        <span className="text-gold">IO</span>
      </span>
    </div>
  )
}

/** Standalone store/subscription badge mark (gold gradient tile). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-gold elevate-gold relative inline-flex items-center justify-center rounded-2xl ring-1 ring-primary/40",
        className,
      )}
      aria-hidden="true"
    >
      {/* glossy top-light highlight */}
      <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent" />
      <svg
        viewBox="0 0 24 24"
        className="relative h-5 w-5 text-primary-foreground"
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
  )
}
