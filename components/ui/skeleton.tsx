import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // Premium loading: a soft muted base with a light sweep (`.shimmer`)
      // instead of a flat pulse — reads as "loading", not "broken".
      className={cn("shimmer rounded-lg bg-muted/60", className)}
      {...props}
    />
  )
}

export { Skeleton }
