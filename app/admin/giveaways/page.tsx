"use client"

import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import { Gift, Plus, Users, Trophy, Clock, Trash2 } from "lucide-react"
import { fetcher, apiDelete, ApiError } from "@/lib/api-client"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection"
import { SelectionCheckbox } from "@/components/admin/bulk/selection-checkbox"
import { BulkActionsBar, type BulkDeleteResult } from "@/components/admin/bulk/bulk-actions-bar"

type GiveawayRow = {
  id: string
  slug: string
  title: string
  prizeLabel: string
  status: string
  winnersCount: number
  drawAt: string
  endAt: string
  _count: { entries: number; winners: number }
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "پیش‌نویس", className: "bg-secondary text-muted-foreground" },
  SCHEDULED: { label: "زمان‌بندی‌شده", className: "bg-primary/10 text-primary" },
  ACTIVE: { label: "فعال", className: "bg-success/15 text-success" },
  PAUSED: { label: "متوقف", className: "bg-warning/15 text-warning" },
  LOCKED: { label: "آماده قرعه‌کشی", className: "bg-warning/15 text-warning" },
  DRAWING: { label: "در حال قرعه‌کشی", className: "bg-primary/15 text-primary" },
  FINISHED: { label: "پایان‌یافته", className: "bg-secondary text-muted-foreground" },
  CANCELLED: { label: "لغو شده", className: "bg-destructive/10 text-destructive" },
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function AdminGiveawaysPage() {
  const { data, isLoading, mutate } = useSWR<{ data: GiveawayRow[] }>(
    "/api/v1/admin/giveaways",
    fetcher,
    { refreshInterval: 10000 },
  )
  const rows = data?.data ?? []
  const selection = useBulkSelection(rows.map((g) => g.id))

  async function removeOne(g: GiveawayRow) {
    if (!confirm(`حذف قرعه‌کشی «${g.title}»؟ این عملیات قابل بازگشت نیست.`)) return
    try {
      await apiDelete(`/api/v1/admin/giveaways/${g.id}`)
      toast.success("قرعه‌کشی حذف شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف")
    }
  }

  async function removeSelected(): Promise<BulkDeleteResult> {
    const res = await apiDelete<{ data: BulkDeleteResult }>("/api/v1/admin/giveaways", {
      ids: selection.selectedIds,
    })
    return res.data
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-extrabold">قرعه‌کشی‌ها</h1>
        </div>
        <Link href="/admin/giveaways/new" className={cn(buttonVariants(), "gap-1.5")}>
          <Plus className="h-4 w-4" />
          قرعه‌کشی جدید
        </Link>
      </div>

      {rows.length > 0 && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <SelectionCheckbox
            checked={selection.allSelected}
            indeterminate={selection.someSelected}
            onChange={selection.toggleAll}
            label="انتخاب همه"
            stopPropagation={false}
          />
          انتخاب همه
        </label>
      )}

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Gift className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">هنوز قرعه‌کشی‌ای ساخته نشده است.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((g) => {
            const meta = STATUS_META[g.status] ?? STATUS_META.DRAFT
            return (
              <div
                key={g.id}
                className={cn(
                  "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40",
                  selection.isSelected(g.id) && "border-primary/60 bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SelectionCheckbox
                      checked={selection.isSelected(g.id)}
                      onChange={() => selection.toggle(g.id)}
                      label={`انتخاب ${g.title}`}
                    />
                    <Link href={`/admin/giveaways/${g.id}`} className="hover:underline">
                      <h2 className="font-bold leading-6 text-balance">{g.title}</h2>
                    </Link>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        meta.className,
                      )}
                    >
                      {meta.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOne(g)}
                      aria-label={`حذف ${g.title}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Link href={`/admin/giveaways/${g.id}`} className="flex flex-col gap-3">
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Trophy className="h-3.5 w-3.5 text-primary" />
                    <span className="truncate">{g.prizeLabel}</span>
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <strong className="text-foreground tabular-nums">{g._count.entries}</strong> شرکت‌کننده
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5" />
                      {g._count.winners}/{g.winnersCount} برنده
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {fmtDate(g.drawAt)}
                    </span>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <BulkActionsBar
        count={selection.count}
        itemNoun="قرعه‌کشی"
        onDelete={removeSelected}
        onClear={selection.clear}
        onDone={mutate}
      />
    </div>
  )
}
