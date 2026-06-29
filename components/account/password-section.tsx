"use client"

import { useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { apiPost, ApiError } from "@/lib/api-client"
import type { AccountState } from "@/lib/account-types"
import { useI18n } from "@/components/i18n-provider"

/**
 * Change-password card. Only shown when the account already has a password.
 * (Telegram-only accounts set their first password via the Email section.)
 */
export function PasswordSection({ state }: { state: AccountState }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!state.hasPassword) return null

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (next.length < 8) {
      setError(t("acctPwd.errMin"))
      return
    }
    if (next !== confirm) {
      setError(t("acctPwd.errMismatch"))
      return
    }
    setBusy(true)
    try {
      await apiPost("/api/v1/account/password", { currentPassword: current, newPassword: next })
      setNotice(t("acctPwd.success"))
      setCurrent("")
      setNext("")
      setConfirm("")
      setOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("acctPwd.failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">{t("acctPwd.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("acctPwd.subtitle")}</p>
        </div>
        {!open && (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t("acctPwd.change")}
          </Button>
        )}
      </div>

      {notice && (
        <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">{notice}</p>
      )}

      {open && (
        <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          <Input
            type="password"
            dir="ltr"
            placeholder={t("acctPwd.currentPlaceholder")}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <Input
            type="password"
            dir="ltr"
            placeholder={t("acctPwd.newPlaceholder")}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          <Input
            type="password"
            dir="ltr"
            placeholder={t("acctPwd.confirmPlaceholder")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("acctPwd.save")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
