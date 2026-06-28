"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR, { useSWRConfig } from "swr"
import { ShieldCheck, Send, Loader2 } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/components/i18n-provider"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { TelegramLoginButton } from "@/components/auth/telegram-login-button"

type PublicConfig = { data: { brandName?: string; botUsername?: string } }

export function AuthForm() {
  const { t, dir } = useI18n()
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const { data: cfg } = useSWR<PublicConfig>("/api/v1/public/config", fetcher)
  const botUsername = cfg?.data?.botUsername?.replace(/^@/, "") || ""
  const brandName = cfg?.data?.brandName || "Subio"

  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finishLogin = useCallback(async () => {
    await mutate("/api/v1/auth/session")
    router.replace("/")
    router.refresh()
  }, [mutate, router])

  const onTelegramAuth = useCallback(
    async (payload: Record<string, unknown>) => {
      setError(null)
      setBusy(true)
      try {
        await apiPost("/api/v1/auth/telegram", payload)
        await finishLogin()
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "خطا در ورود با تلگرام")
        setBusy(false)
      }
    },
    [finishLogin],
  )

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const url = mode === "signup" ? "/api/v1/auth/register" : "/api/v1/auth/login"
      await apiPost(url, {
        email,
        password,
        ...(mode === "signup" && displayName ? { displayName } : {}),
      })
      await finishLogin()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطایی رخ داد")
      setBusy(false)
    }
  }

  const privacyPoints = [t("auth.privacy1"), t("auth.privacy2"), t("auth.privacy3"), t("auth.privacy4")]

  return (
    <div className="w-full max-w-md" dir={dir}>
      <div className="glass rounded-3xl border border-primary/15 p-6 shadow-2xl sm:p-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo />
          <h1 className="text-balance text-xl font-extrabold text-foreground">{brandName}</h1>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {t("auth.tagline")}
          </p>
        </div>

        {/* Telegram login */}
        <div className="mt-6 flex flex-col items-center gap-2">
          {botUsername ? (
            <TelegramLoginButton botUsername={botUsername} onAuth={onTelegramAuth} />
          ) : (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-bold text-white opacity-60">
              <Send className="h-4 w-4" />
              {t("auth.telegramBtn")}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t("auth.secureNote")}</p>
          {!botUsername && (
            <p className="text-center text-xs text-muted-foreground/80">{t("auth.widgetMissing")}</p>
          )}
        </div>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Email / password */}
        <form onSubmit={onEmailSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <Input
              type="text"
              placeholder={t("auth.displayName")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          )}
          <Input
            type="email"
            required
            placeholder={t("auth.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            autoComplete="email"
          />
          <Input
            type="password"
            required
            placeholder={t("auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={mode === "signup" ? 8 : undefined}
          />

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <Button type="submit" variant="gold" size="lg" disabled={busy} className="mt-1 w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? t("auth.signingIn") : mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"))
              setError(null)
            }}
            className="w-full text-primary hover:text-primary"
          >
            {mode === "signin" ? t("auth.toSignUp") : t("auth.toSignIn")}
          </Button>

          {mode === "signin" && (
            <Link
              href="/forgot-password"
              className="text-center text-xs text-muted-foreground transition-opacity hover:opacity-80"
            >
              رمز عبور خود را فراموش کرده‌اید؟
            </Link>
          )}
        </form>
      </div>

      {/* Privacy & security */}
      <div className="glass mt-4 rounded-2xl border border-primary/10 p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wide text-primary">
            {t("auth.privacyTitle")}
          </h2>
        </div>
        <ul className="flex flex-col gap-2.5">
          {privacyPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-pretty">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
