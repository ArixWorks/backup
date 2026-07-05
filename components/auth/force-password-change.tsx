"use client"

import { useState } from "react"
import { useSWRConfig } from "swr"
import { ShieldAlert, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSession } from "@/hooks/use-session"
import { apiPost, ApiError } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"

/**
 * Blocking overlay shown when the signed-in account is flagged
 * `mustChangePassword` (e.g. a provisioned admin using a temporary password).
 * The user cannot dismiss it until a new password is set.
 */
export function ForcePasswordChange() {
  const { user } = useSession()
  const { t } = useI18n()
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
      await mutate("/api/v1/auth/session")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("acctPwd.failed"))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-md rounded-3xl border border-primary/20 p-6">
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-extrabold text-foreground">{t("forcePwd.title")}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("forcePwd.desc")}
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-2">
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
          <Button type="submit" variant="gold" size="lg" disabled={busy} className="mt-1 w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("forcePwd.save")}
          </Button>
        </form>
      </div>
    </div>
  )
}
