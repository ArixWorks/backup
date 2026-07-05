"use client"

import { useState } from "react"
import { Mail, BadgeCheck, Clock, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { apiPost, ApiError } from "@/lib/api-client"
import type { AccountState } from "@/lib/account-types"
import { useI18n } from "@/components/i18n-provider"

/**
 * Email + verification card. Three states:
 *  - No email: lets a Telegram-only user add an email (+ optional password).
 *  - Pending: an unverified/changed email awaits confirmation; can resend.
 *  - Verified: locked (cannot be changed from the UI).
 */
export function EmailSection({
  state,
  onChanged,
}: {
  state: AccountState
  onChanged: () => void
}) {
  const { t } = useI18n()
  const { email, hasPassword } = state
  const verified = email.verified
  const pending = email.pending

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(email.address ?? "")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // A Telegram-only account without a password must set one alongside the email.
  const needsPassword = !hasPassword

  async function send(targetEmail: string, pwd?: string) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await apiPost("/api/v1/account/email", {
        email: targetEmail,
        ...(pwd ? { password: pwd } : {}),
      })
      setNotice(t("acctEmail.sentNotice"))
      setEditing(false)
      setPassword("")
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("acctEmail.sendFailed"))
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    if (needsPassword && password.length < 8) {
      setError(t("acctEmail.errMinPassword"))
      return
    }
    send(value.trim(), needsPassword ? password : undefined)
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Mail className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">{t("acctEmail.title")}</h2>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {email.address || t("acctEmail.notSet")}
          </p>
        </div>
        {verified ? (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            <BadgeCheck className="h-3.5 w-3.5" />
            {t("acctEmail.verified")}
          </span>
        ) : email.address ? (
          <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-1 text-xs font-semibold text-warning">
            <Clock className="h-3.5 w-3.5" />
            {t("acctEmail.unverified")}
          </span>
        ) : null}
      </div>

      {pending && (
          <p className="mb-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          {t("acctEmail.pending")}
          <span dir="ltr">{pending}</span>
        </p>
      )}

      {notice && (
        <p className="mb-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">{notice}</p>
      )}
      {error && (
        <p className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      {verified ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("acctEmail.verifiedLocked")}
        </p>
      ) : editing || !email.address ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <Input
            type="email"
            dir="ltr"
            inputMode="email"
            placeholder="you@example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          {needsPassword && (
            <Input
              type="password"
              dir="ltr"
              placeholder={t("acctEmail.choosePassword")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("acctEmail.sendVerify")}
            </Button>
            {email.address && (
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => send(email.address as string)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("acctEmail.resend")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(true)} disabled={busy}>
            {t("acctEmail.change")}
          </Button>
        </div>
      )}
    </section>
  )
}
