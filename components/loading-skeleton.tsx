import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The single, canonical loading placeholder for product / auction / giveaway
 * cards across the platform. Every list and rail that streams card data should
 * render this while loading so the "premium shimmer" pattern reads identically
 * everywhere (home, auctions, flash, watchlist, recommendations, giveaways).
 *
 * It mirrors the real card silhouette — media block + two text lines + a meta
 * row — so the layout doesn't jump when content resolves (no CLS).
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "card-premium overflow-hidden rounded-2xl border border-border",
        className,
      )}
      aria-hidden
    >
      <Skeleton className="aspect-[16/10] w-full rounded-none rounded-t-2xl" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3.5 w-10" />
        </div>
        <div className="flex items-end justify-between gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  )
}

/**
 * A vertical stack of {@link CardSkeleton}s. Use for loading states of card
 * lists/rails. `count` defaults to 2 (the typical above-the-fold count).
 */
export function CardListSkeleton({
  count = 2,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/**
 * The canonical loading placeholder for compact LIST ROWS (notifications,
 * watched products, orders, prizes) — a full-width rounded block. `h` lets
 * each surface match its real row height so there's no layout shift.
 */
export function RowSkeleton({
  h = "h-20",
  className,
}: {
  h?: string
  className?: string
}) {
  return (
    <Skeleton className={cn("w-full rounded-2xl", h, className)} aria-hidden />
  )
}

/**
 * A vertical stack of {@link RowSkeleton}s for list loading states.
 */
export function RowListSkeleton({
  count = 4,
  h = "h-20",
  className,
}: {
  count?: number
  h?: string
  className?: string
}) {
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, i) => (
        <RowSkeleton key={i} h={h} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}
