"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
import { apiPost, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Must match the Persian phrase the owner types, and the server-side literal.
const TYPE_PHRASE = "حذف کامل اطلاعات"
const SERVER_CONFIRM = "ERASE-ALL-DATA"

export function DangerZone() {
  const router = useRouter()
  const [typed, setTyped] = useState("")
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)

  const phraseOk = typed.trim() === TYPE_PHRASE

  async function runReset() {
    setBusy(true)
    try {
      const res = await apiPost<{ data: { deletedRows: number; hasPassword: boolean } }>(
        "/api/v1/admin/danger/reset",
        { confirm: SERVER_CONFIRM },
      )
      const n = res?.data?.deletedRows ?? 0
      toast.success(`ریست کامل انجام شد — ${n.toLocaleString("fa-IR")} ردیف حذف شد. حساب مالک بازسازی شد.`)
      setArmed(false)
      setTyped("")
      // Session was re-issued for the freshly recreated owner; reload so the
      // whole app picks up the clean state.
      setTimeout(() => router.push("/admin"), 1200)
      setTimeout(() => router.refresh(), 1400)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ریست دیتابیس")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 pt-1">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="text-xl font-extrabold text-destructive">ناحیه خطر</h2>
      </div>

      <div className="max-w-xl space-y-4 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-5">
        <div className="space-y-1.5">
          <div className="font-bold text-destructive">ریست کامل دیتابیس</div>
          <p className="text-sm leading-6 text-muted-foreground">
            این عملیات تمام کاربران، کیف‌پول‌ها، تراکنش‌ها، محصولات، مزایده‌ها، سفارش‌ها، پاداش‌ها و
            کل داده‌های تراکنشی را برای همیشه حذف می‌کند. تنظیمات ساختاری (ارزها، نرخ‌ها، نشان‌ها،
            مأموریت‌ها، قوانین هشدار) حفظ می‌شود و حساب مالک اصلی بلافاصله بازسازی می‌شود.
          </p>
          <p className="text-xs font-medium text-destructive">
            این عمل غیرقابل بازگشت است. فقط مالک اصلی مجاز به اجرای آن است.
          </p>
        </div>

        {!armed ? (
          <div className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">
                برای فعال شدن، عبارت «{TYPE_PHRASE}» را دقیقاً تایپ کنید
              </span>
              <Input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={TYPE_PHRASE}
                className="border-destructive/40"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <Button
              type="button"
              variant="destructive"
              disabled={!phraseOk}
              onClick={() => setArmed(true)}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              ادامه به ریست کامل
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm font-bold text-destructive">
              آیا کاملاً مطمئن هستید؟ همه‌چیز پاک خواهد شد و راه بازگشتی نیست.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="destructive" disabled={busy} onClick={runReset} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                بله، همه‌چیز را پاک کن
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setArmed(false)
                  setTyped("")
                }}
              >
                انصراف
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
