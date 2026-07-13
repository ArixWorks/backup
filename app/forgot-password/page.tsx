"use client"

import { useState } from "react"
import Link from "next/link"
import { MailCheck, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button, buttonVariants } from "@/components/ui/button"
import { apiPost, ApiError } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { AuthShell } from "@/components/auth/auth-shell"

export default function ForgotPasswordPage() {
  const { t, errorMessage } = useI18n()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await apiPost("/api/v1/auth/password/forgot", { email: email.trim() })
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={t("auth.forgotTitle")} description={t("auth.forgotDesc")}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="h-12 w-12 text-primary" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("auth.forgotSentDesc")}
          </p>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline", className: "mt-2 w-full" })}
          >
            {t("auth.backToLogin")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          <Input
            type="email"
            dir="ltr"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" variant="gold" size="lg" disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.sendResetLink")}
          </Button>
          <Link
            href="/login"
            className="text-center text-xs text-muted-foreground transition-opacity hover:opacity-80"
          >
            {t("auth.backToLogin")}
          </Link>
        </form>
      )}
    </AuthShell>
  )
}
