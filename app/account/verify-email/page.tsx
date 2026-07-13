"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { BadgeCheck, XCircle, Loader2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { apiPost, ApiError } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { AuthShell } from "@/components/auth/auth-shell"

function VerifyInner() {
  const { t, errorMessage } = useI18n()
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
      setMessage(t("verify.invalidLink"))
      return
    }
    apiPost("/api/v1/account/email/confirm", { token })
      .then(() => setStatus("ok"))
      .catch((e) => {
        setStatus("error")
        setMessage(errorMessage(e))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <AuthShell contentClassName="text-center">
      {status === "working" && (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("verify.working")}</p>
        </div>
      )}

      {status === "ok" && (
        <div className="flex flex-col items-center gap-3">
          <BadgeCheck className="h-12 w-12 text-primary" />
          <h1 className="text-lg font-extrabold text-foreground">{t("verify.okTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("verify.okDesc")}</p>
          <Link href="/account" className={buttonVariants({ variant: "gold", className: "mt-2 w-full" })}>
            {t("verify.backToAccount")}
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-3">
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="text-lg font-extrabold text-foreground">{t("verify.failedTitle")}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <Link
            href="/account"
            className={buttonVariants({ variant: "outline", className: "mt-2 w-full" })}
          >
            {t("verify.backToAccount")}
          </Link>
        </div>
      )}
    </AuthShell>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  )
}
