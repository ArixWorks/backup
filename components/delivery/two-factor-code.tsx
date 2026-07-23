"use client"

/**
 * On-demand 2FA (TOTP) control for a delivered credential. Fetches the current
 * allowance, lets the recipient draw a short-lived code (with a live countdown),
 * and — once the allowance is exhausted — opens a re-request to the admin.
 * Rendered inside the orders page delivery card when `delivery.has2fa` is true.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Copy, Loader2, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react"
import { apiPost, fetcher, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog"
import { EnhancedTextarea } from "@/components/ui/enhanced-textarea"

type Status = {
  available: boolean
  used: number
  limit: number | null
  remaining: number | null
  reRequest: { status: "PENDING" | "APPROVED" | "REJECTED"; adminMessage: string | null } | null
} | null

type Issued = { code: string; expiresInSec: number; period: number; remaining: number | null }

export function TwoFactorCode({ deliveryId }: { deliveryId: string }) {
  const base = `/api/v1/orders/deliveries/${deliveryId}/totp`
  const { data: status, mutate } = useSWR<Status>(base, fetcher)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [loading, setLoading] = useState(false)
  const [reqOpen, setReqOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Countdown for the currently displayed code; clears the code at expiry.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current)
    if (secondsLeft <= 0) {
      setIssued(null)
      return
    }
    timer.current = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [secondsLeft])

  const getCode = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiPost<Issued>(base)
      setIssued(res)
      setSecondsLeft(res.expiresInSec)
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در دریافت کد")
      if (err instanceof ApiError && err.status === 429) await mutate()
    } finally {
      setLoading(false)
    }
  }, [base, mutate])

  async function submitReRequest() {
    if (reason.trim().length < 3) return toast.error("لطفاً دلیل درخواست را بنویسید")
    setSubmitting(true)
    try {
      await apiPost(`${base}/re-request`, { reason: reason.trim() })
      toast.success("درخواست شما ثبت شد و در انتظار بررسی است")
      setReqOpen(false)
      setReason("")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ثبت درخواست")
    } finally {
      setSubmitting(false)
    }
  }

  // No 2FA attached to this credential.
  if (status === null) return null

  const exhausted = status && status.available === false
  const pending = status?.reRequest?.status === "PENDING"
  const rejected = status?.reRequest?.status === "REJECTED"

  return (
    <div className="rounded-lg border border-border bg-secondary/60 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        رمز دومرحله‌ای (۲FA)
        {status?.limit != null && (
          <span className="ms-auto text-[11px] font-normal tabular-nums text-muted-foreground">
            {status.remaining} از {status.limit} باقی‌مانده
          </span>
        )}
      </div>

      {issued ? (
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-[0.3em] text-primary" dir="ltr">
            {issued.code}
          </span>
          <button
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(issued.code).then(
                () => toast.success("کد کپی شد"),
                () => toast.error("کپی نشد"),
              )
            }
            aria-label="کپی کد"
            className="text-muted-foreground transition hover:text-primary"
          >
            <Copy className="h-4 w-4" />
          </button>
          <span
            className="ms-auto tabular-nums text-sm font-semibold text-muted-foreground"
            aria-live="polite"
          >
            {secondsLeft}s
          </span>
        </div>
      ) : exhausted ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            سقف دریافت کد به پایان رسیده است.
          </p>
          {pending ? (
            <p className="text-xs text-muted-foreground">درخواست دریافت مجدد شما در حال بررسی است.</p>
          ) : (
            <>
              {rejected && status?.reRequest?.adminMessage && (
                <p className="text-xs text-destructive">پاسخ ادمین: {status.reRequest.adminMessage}</p>
              )}
              <Button size="sm" variant="outline" onClick={() => setReqOpen(true)} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                درخواست دریافت مجدد
              </Button>
            </>
          )}
        </div>
      ) : (
        <Button size="sm" onClick={getCode} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          دریافت کد
        </Button>
      )}

      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>درخواست دریافت مجدد کد ۲FA</DialogTitle>
            <DialogDescription>
              دلیل نیاز به کدهای بیشتر را بنویسید. پس از تأیید ادمین، امکان دریافت مجدد فعال می‌شود.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <EnhancedTextarea
              value={reason}
              onChange={setReason}
              minRows={3}
              maxRows={8}
              showCount={false}
              placeholder="مثلاً: دستگاهم را عوض کردم و نیاز به ورود مجدد دارم."
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReqOpen(false)} disabled={submitting}>
              انصراف
            </Button>
            <Button onClick={submitReRequest} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              ثبت درخواست
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
