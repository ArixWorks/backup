import { Boxes, Gavel, Globe, ListChecks } from "lucide-react"
import type { FulfillmentKind } from "@/lib/orders/shared"
import { cn } from "@/lib/utils"

const CONFIG: Record<
  Exclude<FulfillmentKind, "NONE">,
  { label: string; icon: typeof Boxes; className: string }
> = {
  MANUAL: { label: "تحویل دستی", icon: Boxes, className: "bg-primary/10 text-primary" },
  ROADMAP: { label: "نقشه‌راه", icon: ListChecks, className: "bg-success/10 text-success" },
  DOMAIN: { label: "دامنه", icon: Globe, className: "bg-warning/15 text-warning" },
  AUCTION: { label: "مزایده", icon: Gavel, className: "bg-secondary text-secondary-foreground" },
}

/** Small chip signalling how an order is fulfilled (drives which flow applies). */
export function FulfillmentBadge({ kind, className }: { kind: FulfillmentKind; className?: string }) {
  if (kind === "NONE") return null
  const c = CONFIG[kind]
  const Icon = c.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        c.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  )
}
