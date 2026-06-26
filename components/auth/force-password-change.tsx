"use client"

import { useState } from "react"
import { useSWRConfig } from "swr"
import { ShieldAlert, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSession } from "@/hooks/use-session"
import { apiPost, ApiError } from "@/lib/api-client"

/**
 * Blocking overlay shown when the signed-in account is flagged
 * `mustChangePassword` (e.g. a provisioned admin using a temporary password).
 * The user cannot dismiss it until a new password is set.
 */
export function ForcePasswordChange() {
  const { user } = useSession()
  const { mutate } = useSWRConfig()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user || !user.mustChangePassword) return null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) {
      setError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد")
      return
    }
    if (next !== confirm) {
      setError("تکرار رمز عبور مطابقت ندارد")
      return
    }
    setBusy(true)
    try {
      await apiPost("/api/v1/account/password", { currentPassword: current, newPassword: next })
      await mutate("/api/v1/auth/session")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تغییر رمز عبور ناموفق بود")
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-md rounded-3xl border border-primary/20 p-6">
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-extrabold text-foreground">تغییر رمز عبور الزامی است</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            برای ادامه، لطفاً یک رمز عبور جدید و امن برای حساب خود تنظیم کنید.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          <Input
            type="password"
            dir="ltr"
            placeholder="رمز عبور فعلی"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <Input
            type="password"
            dir="ltr"
            placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          <Input
            type="password"
            dir="ltr"
            placeholder="تکرار رمز عبور جدید"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button type="submit" disabled={busy} className="mt-1 w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ذخیره و ادامه"}
          </Button>
        </form>
      </div>
    </div>
  )
}
