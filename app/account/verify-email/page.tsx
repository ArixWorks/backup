"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BadgeCheck, XCircle, Loader2 } from "lucide-react"
import { Logo } from "@/components/logo"
import { buttonVariants } from "@/components/ui/button"
import { apiPost, ApiError } from "@/lib/api-client"

function VerifyInner() {
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const [status, setStatus] = useState<"working" | "ok" | "error">("working")
  const [message, setMessage] = useState("")
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (!token) {
      setStatus("error")
      setMessage("لینک تأیید نامعتبر است.")
      return
    }
    apiPost("/api/v1/account/email/confirm", { token })
      .then(() => setStatus("ok"))
      .catch((e) => {
        setStatus("error")
        setMessage(e instanceof ApiError ? e.message : "تأیید ایمیل ناموفق بود.")
      })
  }, [token])

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="glass w-full max-w-md rounded-3xl border border-primary/15 p-8 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>

        {status === "working" && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">در حال تأیید ایمیل…</p>
          </div>
        )}

        {status === "ok" && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <BadgeCheck className="h-12 w-12 text-primary" />
            <h1 className="text-lg font-extrabold text-foreground">ایمیل شما تأیید شد</h1>
            <p className="text-sm text-muted-foreground">اکنون می‌توانید با ایمیل و رمز عبور وارد شوید.</p>
            <Link href="/account" className={buttonVariants({ className: "mt-2 w-full" })}>
              بازگشت به تنظیمات حساب
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <XCircle className="h-12 w-12 text-destructive" />
            <h1 className="text-lg font-extrabold text-foreground">تأیید ناموفق بود</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Link
              href="/account"
              className={buttonVariants({ variant: "outline", className: "mt-2 w-full" })}
            >
              بازگشت به تنظیمات حساب
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  )
}
