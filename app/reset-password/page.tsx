"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Logo } from "@/components/logo"
import { Input } from "@/components/ui/input"
import { Button, buttonVariants } from "@/components/ui/button"
import { apiPost, ApiError } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"

function ResetInner() {
  const { t } = useI18n()
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const invalidToken = !token

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError("رمز عبور باید حداقل ۸ کاراکتر باشد")
      return
    }
    if (password !== confirm) {
      setError("تکرار رمز عبور مطابقت ندارد")
      return
    }
    setBusy(true)
    try {
      await apiPost("/api/v1/auth/password/reset", { token, password })
      setDone(true)
      setTimeout(() => router.replace("/login"), 1800)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "بازنشانی رمز عبور ناموفق بود")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="glass w-full max-w-md rounded-3xl border border-primary/15 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-xl font-extrabold text-foreground">تنظیم رمز عبور جدید</h1>
        </div>

        {done ? (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <p className="text-sm text-muted-foreground">در حال انتقال به صفحه ورود…</p>
          </div>
        ) : invalidToken ? (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-destructive">لینک بازنشانی نامعتبر است.</p>
            <Link
              href="/forgot-password"
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              درخواست لینک جدید
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
            )}
            <Input
              type="password"
              dir="ltr"
              placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ذخیره رمز عبور جدید"}
            </Button>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              بازگشت به ورود
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  )
}
