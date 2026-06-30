"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Send } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

/**
 * Renders the official Telegram Login Widget. Telegram injects an iframe button
 * and calls our global callback with the signed payload, which we forward to
 * the parent. Requires the bot's domain to be set via BotFather /setdomain.
 *
 * While the widget script loads we show a branded placeholder (so the user
 * never sees an empty gray box). If the iframe never renders — e.g. the domain
 * isn't authorized in BotFather, or the host is localhost — we surface a clear
 * hint and let the user fall back to email login below.
 */
export function TelegramLoginButton({
  botUsername,
  onAuth,
}: {
  botUsername: string
  onAuth: (data: Record<string, unknown>) => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const cbName = useRef(`onTelegramAuth_${Math.random().toString(36).slice(2)}`)
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")

  useEffect(() => {
    const name = cbName.current
    // Telegram calls window[name](user) when login succeeds.
    ;(window as unknown as Record<string, unknown>)[name] = (user: Record<string, unknown>) =>
      onAuth(user)

    const container = ref.current
    if (!container) return
    container.innerHTML = ""
    setStatus("loading")

    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.async = true
    script.setAttribute("data-telegram-login", botUsername)
    script.setAttribute("data-size", "large")
    script.setAttribute("data-radius", "12")
    script.setAttribute("data-onauth", `${name}(user)`)
    script.setAttribute("data-request-access", "write")
    script.onerror = () => setStatus("failed")
    container.appendChild(script)

    // The widget injects an <iframe>. Poll briefly; if it never appears the
    // domain is almost certainly not authorized for this host.
    let elapsed = 0
    const interval = window.setInterval(() => {
      elapsed += 400
      const iframe = container.querySelector("iframe")
      if (iframe) {
        // The Telegram widget injects this iframe; give it an accessible name
        // so it doesn't trip WCAG "frames must have a title".
        if (!iframe.getAttribute("title")) iframe.setAttribute("title", t("auth.telegramBtn"))
        setStatus("ready")
        window.clearInterval(interval)
      } else if (elapsed >= 5000) {
        setStatus("failed")
        window.clearInterval(interval)
      }
    }, 400)

    return () => {
      window.clearInterval(interval)
      delete (window as unknown as Record<string, unknown>)[name]
      if (container) container.innerHTML = ""
    }
  }, [botUsername, onAuth, t])

  return (
    <div className="w-full">
      <div ref={ref} className="flex min-h-[48px] justify-center" />

      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-bold text-white">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("tgLogin.loading")}
        </div>
      )}

      {status === "failed" && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9]/60 px-4 py-3 text-sm font-bold text-white">
            <Send className="h-4 w-4" />
            {t("tgLogin.unavailable")}
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            {t("tgLogin.domainNotice")}
          </p>
        </div>
      )}
    </div>
  )
}
