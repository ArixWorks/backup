"use client"

import { useSyncExternalStore } from "react"

/**
 * Environment-first layout signal.
 *
 * The chrome switch (mini-app vs web dashboard) is driven by CSS `tg:`/`web:`
 * variants keyed off `data-env` on <html> (set synchronously in <head> before
 * paint). This hook exposes the SAME signal to React for the handful of places
 * that need behavioral branching rather than styling — e.g. ResponsiveDialog
 * choosing a Drawer vs a Dialog, or motion deciding how rich an effect to run.
 *
 * It reads the live `data-env` attribute via useSyncExternalStore so it is
 * SSR-safe (server snapshot = "web", matching the layout default) and stays in
 * sync if TelegramProvider promotes the environment after the SDK resolves.
 */

export type AppEnvironment = "telegram" | "web"

function subscribe(onChange: () => void) {
  if (typeof document === "undefined") return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-env"],
  })
  return () => observer.disconnect()
}

function getSnapshot(): AppEnvironment {
  if (typeof document === "undefined") return "web"
  return document.documentElement.dataset.env === "telegram" ? "telegram" : "web"
}

// Server + first client render agree on "web" (the <html data-env> SSR default),
// so hydration never mismatches; a real Telegram launch is already "telegram"
// in the DOM by the time this runs on the client.
function getServerSnapshot(): AppEnvironment {
  return "web"
}

/** Telegram client platform, when available (android | ios | tdesktop | …). */
function readPlatform(): string | null {
  if (typeof window === "undefined") return null
  return window.Telegram?.WebApp?.platform ?? null
}

export function useEnvironment() {
  const env = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const isTelegram = env === "telegram"
  return {
    env,
    isTelegram,
    isWeb: !isTelegram,
    /** Only meaningful inside Telegram; null on the plain web. */
    platform: isTelegram ? readPlatform() : null,
  }
}
