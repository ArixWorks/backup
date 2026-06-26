"use client"

import { useState } from "react"
import useSWR from "swr"
import { ShieldCheck, LogOut, Loader2, Send, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { EmailSection } from "@/components/account/email-section"
import { PasswordSection } from "@/components/account/password-section"
import { TelegramSection } from "@/components/account/telegram-section"
import type { AccountState } from "@/lib/account-types"

type StateResponse = { ok: boolean; data: AccountState }

export default function AccountPage() {
  const { data, mutate, isLoading } = useSWR<StateResponse>("/api/v1/account/state", fetcher)
  const state = data?.data
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  function refresh() {
    mutate()
  }

  async function logoutAll() {
    setLogoutError(null)
    setLoggingOut(true)
    try {
      await apiPost("/api/v1/auth/logout-all")
      // The session is now invalid everywhere; send the user to login.
      window.location.href = "/login"
    } catch (e) {
      setLogoutError(e instanceof ApiError ? e.message : "خروج از همه دستگاه‌ها ناموفق بود")
      setLoggingOut(false)
    }
  }

  if (isLoading || !state) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const methodLabels: Record<string, string> = {
    telegram: "تلگرام",
    password: "ایمیل و رمز عبور",
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-extrabold">تنظیمات حساب و امنیت</h1>
          <p className="text-xs text-muted-foreground">روش‌های ورود و امنیت حساب خود را مدیریت کنید</p>
        </div>
      </header>

      {/* Active login methods summary */}
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <h2 className="mb-2 text-sm font-bold text-foreground">روش‌های ورود فعال</h2>
        {state.methods.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {state.methods.map((m) => (
              <span
                key={m}
                className="flex items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-semibold text-foreground"
              >
                {m === "telegram" ? (
                  <Send className="h-3.5 w-3.5 text-[#229ED9]" />
                ) : (
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                )}
                {methodLabels[m] ?? m}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            هنوز هیچ روش ورود کاملی فعال نیست. برای ایمن‌سازی حساب، ایمیل خود را تأیید کنید یا تلگرام را
            متصل کنید.
          </p>
        )}
      </section>

      <TelegramSection state={state} onChanged={refresh} />
      <EmailSection state={state} onChanged={refresh} />
      <PasswordSection state={state} />

      {/* Danger zone: log out everywhere */}
      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <h2 className="text-sm font-bold text-foreground">خروج از همه دستگاه‌ها</h2>
        <p className="mb-3 mt-1 text-xs leading-relaxed text-muted-foreground">
          با این کار همه نشست‌های فعال در سایر دستگاه‌ها باطل می‌شوند و باید دوباره وارد شوید.
        </p>
        {logoutError && (
          <p className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {logoutError}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full text-destructive"
          onClick={logoutAll}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <LogOut className="h-4 w-4" />
              خروج از همه دستگاه‌ها
            </>
          )}
        </Button>
      </section>
    </div>
  )
}
