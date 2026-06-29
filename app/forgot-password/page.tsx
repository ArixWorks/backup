"use client"

import { useState } from "react"
import Link from "next/link"
import { MailCheck, Loader2 } from "lucide-react"
import { Logo } from "@/components/logo"
import { Input } from "@/components/ui/input"
import { Button, buttonVariants } from "@/components/ui/button"
import { apiPost, ApiError } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"

export default function ForgotPasswordPage() {
  const { t } = useI18n()
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
      setError(err instanceof ApiError ? err.message : t("auth.genericError"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="glass w-full max-w-md rounded-3xl border border-primary/15 p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-xl font-extrabold text-foreground">{t("auth.forgotTitle")}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("auth.forgotDesc")}
          </p>
        </div>

        {sent ? (
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
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
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
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
            <Button type="submit" disabled={busy} className="w-full">
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
      </div>
    </div>
  )
}
