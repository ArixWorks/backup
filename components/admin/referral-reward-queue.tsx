"use client"

import { useState } from "react"
import useSWR from "swr"
import { ArrowLeft, ShieldCheck, ShieldX, Ban, Loader2, GitBranch } from "lucide-react"
import { fetcher, apiPost } from "@/lib/api-client"
import { formatToman } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

type RewardRow = {
  id: string
  status: string
  amount: string
  currency: string
  riskScore: number
  riskReason: string | null
  createdAt: string
  creditedAt: string | null
  beneficiary: { id: string; name: string }
  middle: { id: string; name: string }
  trigger: { id: string; name: string }
}

type Payload = { data: { rewards: RewardRow[]; counts: Record<string, number> } }

const STATUS_META: Record<string, { label: string; className: string }> = {
  PENDING: { label: "در انتظار", className: "bg-secondary text-secondary-foreground" },
  PENDING_REVIEW: { label: "نیازمند بررسی", className: "bg-amber-500/15 text-amber-600" },
  AUTO_APPROVED: { label: "تأیید خودکار", className: "bg-emerald-500/15 text-emerald-600" },
  APPROVED: { label: "تأیید مدیر", className: "bg-emerald-500/15 text-emerald-600" },
  REJECTED: { label: "رد شده", className: "bg-destructive/10 text-destructive" },
  BLOCKED: { label: "مسدود", className: "bg-destructive/15 text-destructive" },
}

const FILTERS: { key: string; label: string }[] = [
  { key: "PENDING_REVIEW", label: "نیازمند بررسی" },
  { key: "AUTO_APPROVED", label: "تأیید خودکار" },
  { key: "APPROVED", label: "تأیید مدیر" },
  { key: "REJECTED", label: "رد شده" },
  { key: "BLOCKED", label: "مسدود" },
]

export function ReferralRewardQueue() {
  const [filter, setFilter] = useState<string>("PENDING_REVIEW")
  const [busyId, setBusyId] = useState<string | null>(null)
  const { data, isLoading, mutate } = useSWR<Payload>(
    `/api/v1/admin/referrals/rewards?status=${filter}`,
    fetcher,
  )
  const rewards = data?.data.rewards ?? []
  const counts = data?.data.counts ?? {}

  async function act(rewardId: string, action: "approve" | "reject" | "block") {
    setBusyId(rewardId)
    try {
      const res = await apiPost<{ data: { ok: boolean } }>("/api/v1/admin/referrals/rewards", {
        rewardId,
        action,
      })
      if (res.data.ok) {
        toast.success(
          action === "approve" ? "پاداش تأیید و پرداخت شد" : action === "reject" ? "پاداش رد شد" : "پاداش مسدود شد",
        )
      } else {
        toast.error("این پاداش دیگر قابل تغییر نیست")
      }
      await mutate()
    } catch {
      toast.error("خطا در انجام عملیات")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {f.label}
            {counts[f.key] ? ` (${counts[f.key]})` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : rewards.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          موردی در این وضعیت وجود ندارد.
        </p>
      ) : (
        <ul className="space-y-3">
          {rewards.map((r) => {
            const meta = STATUS_META[r.status] ?? STATUS_META.PENDING
            const reviewable = r.status === "PENDING_REVIEW"
            const busy = busyId === r.id
            return (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Chain viewer: root (beneficiary) → middle → trigger */}
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <GitBranch className="h-4 w-4 shrink-0 text-primary" />
                      <span className="font-bold text-foreground">{r.beneficiary.name}</span>
                      <ArrowLeft className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{r.middle.name}</span>
                      <ArrowLeft className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{r.trigger.name}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {`ریسک: ${r.riskScore} · ${r.riskReason ?? "clean"}`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("fa-IR")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge className={meta.className} variant="secondary">
                      {meta.label}
                    </Badge>
                    <span className="text-gold text-sm font-extrabold tabular-nums">
                      {formatToman(r.amount)}
                    </span>
                  </div>
                </div>

                {reviewable && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button size="sm" disabled={busy} onClick={() => act(r.id, "approve")}>
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      تأیید و پرداخت
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => act(r.id, "reject")}
                    >
                      <ShieldX className="h-4 w-4" />
                      رد
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => act(r.id, "block")}
                    >
                      <Ban className="h-4 w-4" />
                      مسدود (تقلب)
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
