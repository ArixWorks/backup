import { cn } from "@/lib/utils"

const MAP: Record<string, { label: string; cls: string }> = {
  // generic
  PENDING: { label: "در انتظار", cls: "bg-amber-500/15 text-amber-400" },
  APPROVED: { label: "تأییدشده", cls: "bg-success/15 text-success" },
  REJECTED: { label: "ردشده", cls: "bg-destructive/15 text-destructive" },
  PAID: { label: "پرداخت‌شده", cls: "bg-success/15 text-success" },
  // orders
  DELIVERED: { label: "تحویل‌شده", cls: "bg-success/15 text-success" },
  REFUNDED: { label: "بازگشت‌شده", cls: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "لغوشده", cls: "bg-muted text-muted-foreground" },
  FAILED: { label: "ناموفق", cls: "bg-destructive/15 text-destructive" },
  // auctions
  SCHEDULED: { label: "زمان‌بندی‌شده", cls: "bg-blue-500/15 text-blue-400" },
  ACTIVE: { label: "فعال", cls: "bg-success/15 text-success" },
  ENDED: { label: "پایان‌یافته", cls: "bg-amber-500/15 text-amber-400" },
  FINALIZED: { label: "نهایی‌شده", cls: "bg-primary/15 text-primary" },
  // users
  BANNED: { label: "مسدود", cls: "bg-destructive/15 text-destructive" },
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const item = MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground" }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        item.cls,
        className,
      )}
    >
      {item.label}
    </span>
  )
}
