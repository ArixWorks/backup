"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CloudDownload, Loader2, RefreshCcwDot } from "lucide-react"
import { toast } from "sonner"
import { apiGet, apiPost } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"

/**
 * Drives the chunked TLD price sync.
 *
 * The server does the work one slice at a time, so this component owns the loop:
 * `start` once, then `step` until `done`. That keeps each request short while a
 * full ~467-zone run finishes, and gives the admin live progress instead of a
 * request that appears to hang for a minute.
 */

type Mode = "IMPORT" | "REFRESH"

interface SyncProgress {
  jobId: string
  status: "RUNNING" | "DONE" | "FAILED"
  total: number
  processed: number
  found: number
  created: number
  updated: number
  skipped: number
  lastError: string | null
  done: boolean
}

interface Defaults {
  discountPercent: number
  maxUsd: number
  usdRate: number
  lastSyncAt: string | null
}

const fa = (value: number) => value.toLocaleString("fa-IR")

export function DomainPriceSync({ onFinished }: { onFinished: () => void }) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [maxUsd, setMaxUsd] = useState("20")
  const [discountPercent, setDiscountPercent] = useState("50")
  const [usdRate, setUsdRate] = useState(0)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  // Set when the dialog closes mid-run so the async loop knows to stop touching
  // state instead of resurrecting a closed dialog.
  const abandoned = useRef(false)

  useEffect(() => {
    apiGet<{ data: Defaults }>("/api/v1/admin/domains/price-sync")
      .then(({ data }) => {
        setMaxUsd(String(data.maxUsd))
        setDiscountPercent(String(data.discountPercent))
        setUsdRate(data.usdRate)
      })
      .catch(() => {
        /* defaults already seeded in state */
      })
  }, [])

  const open = (next: Mode) => {
    abandoned.current = false
    setProgress(null)
    setMode(next)
  }

  const close = () => {
    // Abandon rather than cancel: already-written prices are valid, and the job
    // row stays queryable. Reopening starts a fresh run.
    abandoned.current = true
    setMode(null)
    setRunning(false)
  }

  const run = useCallback(async () => {
    if (!mode) return
    setRunning(true)
    setProgress(null)
    try {
      let current = await apiPost<{ data: SyncProgress }>("/api/v1/admin/domains/price-sync", {
        action: "start",
        mode,
        maxUsd: Number(maxUsd),
        discountPercent: Number(discountPercent),
      }).then((res) => res.data)
      if (abandoned.current) return
      setProgress(current)

      // Bounded so a server bug can never spin this loop forever.
      const maxSteps = 200
      for (let i = 0; i < maxSteps && !current.done; i += 1) {
        current = await apiPost<{ data: SyncProgress }>("/api/v1/admin/domains/price-sync", {
          action: "step",
          jobId: current.jobId,
        }).then((res) => res.data)
        if (abandoned.current) return
        setProgress(current)
      }

      if (current.status === "FAILED") {
        toast.error(current.lastError ?? "دریافت قیمت‌ها انجام نشد.")
      } else if (mode === "IMPORT") {
        toast.success(
          current.created > 0
            ? `${fa(current.created)} پسوند جدید با قیمت اضافه شد.`
            : "پسوند جدیدی زیر سقف قیمت پیدا نشد.",
        )
      } else {
        toast.success(
          current.updated > 0
            ? `قیمت ${fa(current.updated)} پسوند بروزرسانی شد.`
            : "قیمت‌ها قبلاً بروز بودند؛ تغییری لازم نشد.",
        )
      }
      onFinished()
    } catch (error) {
      if (!abandoned.current) {
        toast.error(error instanceof Error ? error.message : "عملیات انجام نشد.")
      }
    } finally {
      if (!abandoned.current) setRunning(false)
    }
  }, [mode, maxUsd, discountPercent, onFinished])

  const percent = progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0
  const isImport = mode === "IMPORT"

  return (
    <>
      <Button variant="outline" onClick={() => open("IMPORT")}>
        <CloudDownload data-icon="inline-start" />
        دریافت قیمت‌ها
      </Button>
      <Button variant="outline" onClick={() => open("REFRESH")}>
        <RefreshCcwDot data-icon="inline-start" />
        بروزرسانی قیمت‌ها
      </Button>

      <Dialog open={mode !== null} onOpenChange={(next) => (next ? undefined : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isImport ? "دریافت پسوندها از رجیسترار" : "بروزرسانی قیمت پسوندها"}</DialogTitle>
            <DialogDescription>
              {isImport
                ? "پسوندهای آزاد با قیمت زیر سقف تعیین‌شده به کاتالوگ اضافه می‌شوند."
                : "قیمت پسوندهای موجود با رجیسترار مقایسه و در صورت تغییر اصلاح می‌شود."}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium">
              سقف قیمت اصلی (دلار)
              <Input
                dir="ltr"
                className="text-left"
                inputMode="decimal"
                value={maxUsd}
                onChange={(event) => setMaxUsd(event.target.value)}
                disabled={running}
              />
              <span className="text-xs font-normal text-muted-foreground">
                فقط پسوندهایی که قیمت اصلی‌شان کمتر از این مبلغ است اضافه می‌شوند.
              </span>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              درصد تخفیف فروش
              <Input
                dir="ltr"
                className="text-left"
                inputMode="numeric"
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
                disabled={running}
              />
              <span className="text-xs font-normal text-muted-foreground">
                قیمت فروش = قیمت اصلی منهای این درصد. برای مثال ۵۰٪ روی ۱۱ دلار می‌شود ۵.۵ دلار.
              </span>
            </label>

            {usdRate > 0 && (
              <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                نرخ دلار فعلی {fa(usdRate)} تومان است. قیمت‌ها به دلار ذخیره می‌شوند و مبلغ تومانی کاربران با هر
                بروزرسانی نرخ، خودکار محاسبه می‌شود.
              </p>
            )}

            {progress && (
              <div className="flex flex-col gap-3 rounded-lg border p-3">
                <Progress value={percent}>
                  <ProgressLabel>
                    {progress.done ? "پایان یافت" : "در حال پردازش"}
                  </ProgressLabel>
                  <ProgressValue>{() => `${fa(progress.processed)} / ${fa(progress.total)}`}</ProgressValue>
                </Progress>
                <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-muted-foreground">اضافه‌شده</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">{fa(progress.created)}</dd>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-muted-foreground">بروزشده</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">{fa(progress.updated)}</dd>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <dt className="text-muted-foreground">بی‌تغییر</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">{fa(progress.skipped)}</dd>
                  </div>
                </dl>
                {progress.lastError && (
                  <p className="text-xs text-destructive">{progress.lastError}</p>
                )}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={close}>
              {progress?.done ? "بستن" : "انصراف"}
            </Button>
            <Button onClick={() => void run()} disabled={running}>
              {running && <Loader2 className="animate-spin" />}
              {isImport ? "شروع دریافت" : "شروع بروزرسانی"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
