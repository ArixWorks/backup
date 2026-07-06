"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Trash2, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError } from "@/lib/api-client"

/** Shape returned by every bulk-delete endpoint. */
export interface BulkDeleteResult {
  deleted: string[]
  skipped: { id: string; title: string; reason: string }[]
}

/**
 * Sticky action bar shown when one or more rows are selected on an admin list.
 * Handles the destructive confirmation flow and reports a per-item result
 * (deleted vs. skipped, e.g. products blocked by the financial-safety guard).
 */
export function BulkActionsBar({
  count,
  itemNoun = "مورد",
  onDelete,
  onClear,
  onDone,
}: {
  count: number
  /** Persian noun for the entity, e.g. "محصول" / "قرعه‌کشی". */
  itemNoun?: string
  /** Perform the delete. Should return the API result for reporting. */
  onDelete: () => Promise<BulkDeleteResult | void>
  onClear: () => void
  /** Called after a successful (even partial) delete so the caller can refresh.
   * Return type is intentionally loose to accept SWR's `mutate`. */
  onDone: () => unknown
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      const result = await onDelete()
      const deleted = result?.deleted?.length ?? count
      const skipped = result?.skipped ?? []
      if (skipped.length > 0) {
        toast.warning(`${deleted} ${itemNoun} حذف شد، ${skipped.length} مورد حذف نشد`, {
          description: skipped
            .slice(0, 3)
            .map((s) => `${s.title}: ${s.reason}`)
            .join(" • "),
        })
      } else {
        toast.success(`${deleted} ${itemNoun} حذف شد`)
      }
      setConfirmOpen(false)
      onClear()
      await onDone()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف")
    } finally {
      setBusy(false)
    }
  }

  if (count === 0) return null

  return (
    <>
      <div className="sticky bottom-4 z-30 mx-auto flex w-fit items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-2 shadow-lg supports-backdrop-filter:backdrop-blur-md">
        <span className="text-sm font-medium">
          <strong className="tabular-nums">{count}</strong> {itemNoun} انتخاب شد
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="h-8 gap-1.5 rounded-full"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          حذف
        </Button>
        <button
          type="button"
          onClick={onClear}
          aria-label="لغو انتخاب"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              حذف {count} {itemNoun}؟
            </DialogTitle>
            <DialogDescription>
              این عملیات قابل بازگشت نیست. موارد دارای سابقه (مثل سفارش ثبت‌شده) برای حفظ اطلاعات مالی
              حذف نخواهند شد.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={busy}>
              انصراف
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              حذف قطعی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
