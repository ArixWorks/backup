"use client"

import { useCallback, useState } from "react"
import useSWR from "swr"
import { Send, BadgeCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TelegramLoginButton } from "@/components/auth/telegram-login-button"
import { apiPost, apiDelete, fetcher, ApiError } from "@/lib/api-client"
import type { AccountState } from "@/lib/account-types"

type PublicConfig = { data: { brandName?: string; botUsername?: string } }

/**
 * Telegram link/unlink card. Lets a password account attach a Telegram identity
 * via the Login Widget, or detach it — but never lets the user remove their
 * last remaining login method (that rule is enforced server-side too).
 */
export function TelegramSection({
  state,
  onChanged,
}: {
  state: AccountState
  onChanged: () => void
}) {
  const { telegram } = state
  const { data: cfg } = useSWR<PublicConfig>("/api/v1/public/config", fetcher)
  const botUsername = cfg?.data?.botUsername?.replace(/^@/, "") || ""

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWidget, setShowWidget] = useState(false)

  // Whether unlinking is allowed: only if another method (password) remains.
  const canUnlink = state.hasPassword && state.email.verified

  const onAuth = useCallback(
    async (payload: Record<string, unknown>) => {
      setError(null)
      setBusy(true)
      try {
        await apiPost("/api/v1/account/telegram", payload)
        setShowWidget(false)
        onChanged()
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "اتصال تلگرام ناموفق بود")
      } finally {
        setBusy(false)
      }
    },
    [onChanged],
  )

  async function unlink() {
    setError(null)
    setBusy(true)
    try {
      await apiDelete("/api/v1/account/telegram")
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "قطع اتصال تلگرام ناموفق بود")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#229ED9]/15 text-[#229ED9]">
          <Send className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">تلگرام</h2>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {telegram.connected ? (telegram.username ? `@${telegram.username}` : "متصل") : "متصل نشده"}
          </p>
        </div>
        {telegram.connected && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            <BadgeCheck className="h-3.5 w-3.5" />
            متصل
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      <div className="mt-3">
        {telegram.connected ? (
          canUnlink ? (
            <Button
              type="button"
              variant="outline"
              className="w-full text-destructive"
              onClick={unlink}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "قطع اتصال تلگرام"}
            </Button>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              برای قطع اتصال تلگرام، ابتدا یک ایمیل تأییدشده و رمز عبور تنظیم کنید تا راه ورود دیگری
              داشته باشید.
            </p>
          )
        ) : showWidget ? (
          botUsername ? (
            <TelegramLoginButton botUsername={botUsername} onAuth={onAuth} />
          ) : (
            <p className="text-xs text-muted-foreground">اتصال تلگرام در این آدرس فعال نیست.</p>
          )
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowWidget(true)}
            disabled={busy}
          >
            اتصال حساب تلگرام
          </Button>
        )}
      </div>
    </section>
  )
}
