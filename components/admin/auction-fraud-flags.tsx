"use client"

import useSWR from "swr"
import Link from "next/link"
import { toast } from "sonner"
import { ShieldAlert, ShieldX, Check, ExternalLink } from "lucide-react"
import { fetcher, apiPost } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Flag = {
  id: string
  auctionId: string
  auctionTitle: string
  actorName: string
  score: number
  reason: string
  signals: string[]
  action: string
  blocked: boolean
  resolvedAt: string | null
  createdAt: string
}
type Overview = { openCount: number; blockedCount: number; flags: Flag[] }

// Persian labels for the machine-readable dominant reasons.
const REASON_LABELS: Record<string, string> = {
  same_device_cluster: "دستگاه مشترک با حساب دیگر",
  clean: "پاک",
}
function reasonLabel(reason: string): string {
  if (REASON_LABELS[reason]) return REASON_LABELS[reason]
  if (reason.startsWith("same_device")) return "دستگاه مشترک با حساب دیگر"
  if (reason.startsWith("same_ip_and_ua")) return "IP و مرورگر مشترک با حساب دیگر"
  if (reason.startsWith("same_ip")) return "IP مشترک با حساب دیگر"
  if (reason.startsWith("same_subnet")) return "شبکه مشترک با حساب‌های دیگر"
  if (reason.startsWith("high_velocity")) return "سرعت غیرعادی پیشنهاد"
  if (reason === "new_account") return "حساب بسیار جدید"
  return reason
}

export function AuctionFraudFlags() {
  const { data, isLoading, mutate } = useSWR<{ data: Overview }>(
    "/api/v1/admin/auctions/fraud",
    fetcher,
  )
  const o = data?.data
  if (isLoading || !o || o.flags.length === 0) return null

  async function resolve(flagId: string) {
    try {
      await apiPost("/api/v1/admin/auctions/fraud", { flagId })
      toast.success("بررسی شد")
      await mutate()
    } catch {
      toast.error("خطا در ثبت بررسی")
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card" dir="rtl">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ShieldAlert className="h-4 w-4 text-destructive" />
        <h2 className="font-bold">موارد مشکوک مزایده (ضدتقلب)</h2>
        <div className="ms-auto flex items-center gap-2">
          <Badge variant="secondary">{`باز: ${o.openCount}`}</Badge>
          {o.blockedCount > 0 && (
            <Badge variant="destructive">{`مسدودشده: ${o.blockedCount}`}</Badge>
          )}
        </div>
      </header>
      <ul className="divide-y divide-border">
        {o.flags.map((f) => (
          <li key={f.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={
                f.blocked
                  ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
                  : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"
              }
            >
              {f.blocked ? <ShieldX className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{f.actorName}</p>
                {f.blocked && (
                  <Badge variant="destructive" className="shrink-0 text-[10px]">
                    مسدود شد
                  </Badge>
                )}
                {f.resolvedAt && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    بررسی‌شده
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {`${reasonLabel(f.reason)} · امتیاز ${f.score}`}
              </p>
              <Link
                href={`/auctions/${f.auctionId}`}
                target="_blank"
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="truncate">{f.auctionTitle}</span>
              </Link>
            </div>
            {!f.resolvedAt && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1"
                onClick={() => resolve(f.id)}
              >
                <Check className="h-3.5 w-3.5" />
                بررسی شد
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
