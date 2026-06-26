"use client"

import { useEffect } from "react"
import { useSWRConfig } from "swr"

/**
 * Bootstraps the Telegram Mini App experience when the site is opened inside
 * Telegram. It:
 *  - requests true fullscreen (Bot API 8.0) on supported clients, falling back
 *    to expand() on older ones
 *  - mirrors Telegram's device + content safe-area insets into CSS variables so
 *    our chrome never sits under the notch or Telegram's floating controls
 *  - disables vertical swipe-to-close so scrolling never dismisses the app
 *  - authenticates via initData (sets our session cookie) and revalidates
 *
 * Outside Telegram it is a no-op, so the normal web app is unaffected.
 */

type Inset = { top: number; bottom: number; left: number; right: number }

type TelegramWebApp = {
  initData: string
  version?: string
  isFullscreen?: boolean
  safeAreaInset?: Inset
  contentSafeAreaInset?: Inset
  ready: () => void
  expand: () => void
  isVersionAtLeast?: (v: string) => boolean
  requestFullscreen?: () => void
  exitFullscreen?: () => void
  disableVerticalSwipes?: () => void
  enableClosingConfirmation?: () => void
  openTelegramLink?: (url: string) => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  onEvent?: (event: string, handler: () => void) => void
  offEvent?: (event: string, handler: () => void) => void
  colorScheme?: string
  themeParams?: Record<string, string>
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

const BG = "#0d0f14"

/** Push Telegram's safe-area insets into CSS custom properties on <html>. */
function applyInsets(wa: TelegramWebApp) {
  const root = document.documentElement
  const safe = wa.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 }
  const content = wa.contentSafeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 }
  // Total inset = device safe area + Telegram's own UI (close/menu) safe area.
  root.style.setProperty("--tg-safe-top", `${safe.top + content.top}px`)
  root.style.setProperty("--tg-safe-bottom", `${safe.bottom + content.bottom}px`)
  root.style.setProperty("--tg-safe-left", `${safe.left + content.left}px`)
  root.style.setProperty("--tg-safe-right", `${safe.right + content.right}px`)
}

export function TelegramProvider() {
  const { mutate } = useSWRConfig()

  useEffect(() => {
    let cancelled = false
    let wa: TelegramWebApp | undefined
    const onInsets = () => wa && applyInsets(wa)

    async function boot() {
      // The SDK script may load slightly after hydration; poll briefly.
      for (let i = 0; i < 30; i++) {
        wa = window.Telegram?.WebApp
        if (wa && wa.initData) {
          try {
            wa.ready()
            wa.expand()
            wa.disableVerticalSwipes?.()
            wa.enableClosingConfirmation?.()
            wa.setHeaderColor?.(BG)
            wa.setBackgroundColor?.(BG)

            // True fullscreen is Bot API 8.0+. Guard so older clients don't throw.
            const supportsFullscreen =
              typeof wa.requestFullscreen === "function" &&
              (wa.isVersionAtLeast?.("8.0") ?? false)
            if (supportsFullscreen) {
              wa.requestFullscreen?.()
              document.documentElement.dataset.tgFullscreen = "1"
            }

            applyInsets(wa)
            // Keep insets fresh as the layout / fullscreen state changes.
            wa.onEvent?.("safeAreaChanged", onInsets)
            wa.onEvent?.("contentSafeAreaChanged", onInsets)
            wa.onEvent?.("fullscreenChanged", onInsets)
            wa.onEvent?.("viewportChanged", onInsets)
          } catch {
            /* ignore — never block auth on chrome setup */
          }

          const res = await fetch("/api/telegram/auth", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ initData: wa.initData }),
            credentials: "include",
          })
          if (!cancelled && res.ok) {
            document.documentElement.dataset.telegram = "1"
            await mutate("/api/v1/auth/session")
          }
          return
        }
        await new Promise((r) => setTimeout(r, 100))
      }
    }

    boot()
    return () => {
      cancelled = true
      wa?.offEvent?.("safeAreaChanged", onInsets)
      wa?.offEvent?.("contentSafeAreaChanged", onInsets)
      wa?.offEvent?.("fullscreenChanged", onInsets)
      wa?.offEvent?.("viewportChanged", onInsets)
    }
  }, [mutate])

  return null
}
