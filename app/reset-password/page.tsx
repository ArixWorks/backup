"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button, buttonVariants } from "@/components/ui/button"
import { apiPost, ApiError } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { AuthShell } from "@/components/auth/auth-shell"

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
      setError(t("auth.errMinPassword"))
      return
    }
    if (password !== confirm) {
      setError(t("auth.errPasswordMismatch"))
      return
    }
    setBusy(true)
    try {
      await apiPost("/api/v1/auth/password/reset", { token, password })
      setDone(true)
      setTimeout(() => router.replace("/login"), 1800)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.resetFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={t("auth.resetTitle")}>
      {done ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <p className="text-sm text-muted-foreground">{t("auth.resetRedirecting")}</p>
        </div>
      ) : invalidToken ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-destructive">{t("auth.resetInvalidLink")}</p>
          <Link
            href="/forgot-password"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            {t("auth.requestNewLink")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          <Input
            type="password"
            dir="ltr"
            placeholder={t("auth.newPasswordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            dir="ltr"
            placeholder={t("auth.confirmNewPlaceholder")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button type="submit" variant="gold" size="lg" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.saveNewPassword")}
          </Button>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", className: "w-full" })}
          >
            {t("auth.backToLogin")}
          </Link>
        </form>
      )}
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  )
}
