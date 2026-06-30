"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useSWRConfig } from "swr"

/**
 * Lifecycle of the automatic Telegram Mini App login:
 *  - "detecting":      figuring out whether we were launched from Telegram
 *  - "authenticating": initData found, verifying + creating/loading the user
 *  - "authenticated":  session cookie set and session cache revalidated
 *  - "outside":        not launched from Telegram (plain website)
 *  - "error":          launched from Telegram but the initData login failed
 *
 * The AuthGate reads this so it never bounces a real Telegram user to /login
 * while the auto-login is still in flight (the previous race that showed the
 * login screen on first open for brand-new accounts).
 */
export type TelegramAuthPhase =
  | "detecting"
  | "authenticating"
  | "authenticated"
  | "outside"
  | "error"

const TelegramAuthContext = createContext<{ phase: TelegramAuthPhase }>({ phase: "detecting" })

/** Read the current Telegram auto-login phase from anywhere in the tree. */
export function useTelegramAuth() {
  return useContext(TelegramAuthContext)
}

/**
 * Bootstraps the Telegram Mini App experience when the site is opened inside
 * Telegram. It:
 *  - requests true fullscreen (Bot API 8.0) on supported clients, falling back
 *    to expand() on older ones
 *  - mirrors Telegram's device + content safe-area insets into CSS variables so
 *    our chrome never sits under the notch or Telegram's floating controls
 *  - disables vertical swipe-to-close so scrolling never dismisses the app
 *  - authenticates via initData (sets our session cookie) and revalidates
 *  - publishes its progress via context so the AuthGate can wait for it
 *
 * Outside Telegram it is a no-op, so the normal web app is unaffected.
 */

type Inset = { top: number; bottom: number; left: number; right: number }

type TelegramWebApp = {
  initData: string
  version?: string
  /**
   * Client platform: "android" | "ios" | "tdesktop" | "macos" | "weba" |
   * "webk" | "web" | "unknown". We only request true fullscreen on phones.
   */
  platform?: string
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
  openInvoice?: (url: string, callback?: (status: string) => void) => void
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

// Fallback that matches the default "gold" theme's --background (oklch(0.155
// 0.014 252)). Only used if the runtime color resolve below fails.
const FALLBACK_BG = "#080d12"

/**
 * Resolve the ACTIVE theme's --background to a #rrggbb hex that Telegram's
 * setHeaderColor / setBackgroundColor accept. We read the real computed body
 * background and let a 1x1 canvas convert whatever CSS color space it is in
 * (oklch / rgb / color()) into plain sRGB bytes. Reading it live means the
 * Telegram chrome always matches the app body for ANY theme (gold, aurora, or
 * future ones) — no hardcoded per-theme values to keep in sync.
 */
function resolveThemeBg(): string {
  try {
    const raw =
      getComputedStyle(document.body).backgroundColor ||
      getComputedStyle(document.documentElement).getPropertyValue("--background").trim()
    if (!raw) return FALLBACK_BG
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext("2d")
    if (!ctx) return FALLBACK_BG
    ctx.fillStyle = "#000000"
    ctx.fillStyle = raw // browser parses any valid CSS color string
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")
  } catch {
    return FALLBACK_BG
  }
}

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

/**
 * Synchronously decide whether this load *might* have come from Telegram.
 *
 * Telegram appends a `tgWebApp...` payload to the launch URL (usually in the
 * hash, sometimes in the query string) and exposes WebApp.initData once the SDK
 * script resolves. Any of these signals means we should wait for the initData
 * login instead of treating the visitor as an anonymous website user.
 *
 * This is intentionally permissive: a false positive only costs a brief loader
 * (boot() then resolves to "outside" and the gate redirects), whereas a false
 * negative would resurface the original bug — bouncing a real Telegram user to
 * /login before their account is created.
 */
function launchedFromTelegram(): boolean {
  if (typeof window === "undefined") return false
  const url = window.location.hash + window.location.search
  return /tgWebApp/i.test(url) || !!window.Telegram?.WebApp?.initData
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig()
  // Start optimistic: on the website we resolve to "outside" with no spinner;
  // inside Telegram we start "authenticating" so the gate waits for us.
  const [phase, setPhase] = useState<TelegramAuthPhase>(() =>
    launchedFromTelegram() ? "authenticating" : "detecting",
  )

  useEffect(() => {
    let cancelled = false
    let wa: TelegramWebApp | undefined
    const onInsets = () => wa && applyInsets(wa)
    const set = (p: TelegramAuthPhase) => {
      if (!cancelled) setPhase(p)
    }

    async function boot() {
      // Same permissive launch hint used for the initial phase. Captured once at
      // boot because Telegram clears the #tgWebApp fragment shortly after launch;
      // while this is true we keep polling for initData rather than giving up and
      // declaring "outside".
      const hint = launchedFromTelegram()

      // The SDK script may load slightly after hydration; poll briefly.
      for (let i = 0; i < 30 && !cancelled; i++) {
        wa = window.Telegram?.WebApp
        if (wa && wa.initData) {
          set("authenticating")
          try {
            wa.ready()
            wa.expand()
            wa.disableVerticalSwipes?.()
            wa.enableClosingConfirmation?.()
            // Match Telegram's native header + background to the active theme's
            // real body background so there is no color seam at the top.
            const bg = resolveThemeBg()
            wa.setHeaderColor?.(bg)
            wa.setBackgroundColor?.(bg)

            // True fullscreen is Bot API 8.0+. Guard so older clients don't throw.
            // Only request it on phones (android/ios). On desktop / web clients
            // fullscreen makes the app awkwardly fill the whole window, so there
            // we stick with expand() only.
            const isMobile = wa.platform === "android" || wa.platform === "ios"
            const supportsFullscreen =
              typeof wa.requestFullscreen === "function" &&
              (wa.isVersionAtLeast?.("8.0") ?? false)
            if (isMobile && supportsFullscreen) {
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

          try {
            const res = await fetch("/api/telegram/auth", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ initData: wa.initData }),
              credentials: "include",
            })
            if (cancelled) return
            if (res.ok) {
              document.documentElement.dataset.telegram = "1"
              // Populate the session cache BEFORE flipping to "authenticated"
              // so the gate sees the user immediately and never redirects.
              await mutate("/api/v1/auth/session")
              set("authenticated")
            } else {
              // Verified-but-rejected (expired / bad signature / rate limited):
              // fall back to /login so email or the Login Widget can be used.
              set("error")
            }
          } catch {
            set("error")
          }
          return
        }

        // SDK has loaded but there is no initData and no Telegram launch hint
        // (Telegram always appends the #tgWebApp fragment): this is the plain
        // website, so stop immediately rather than polling the full window.
        if (wa && !wa.initData && !hint) {
          set("outside")
          return
        }
        await new Promise((r) => setTimeout(r, 100))
      }

      // Polling window elapsed. If we had a launch hint but never received
      // initData, surface an error so the gate can recover via /login.
      set(hint ? "error" : "outside")
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

  return <TelegramAuthContext.Provider value={{ phase }}>{children}</TelegramAuthContext.Provider>
}
