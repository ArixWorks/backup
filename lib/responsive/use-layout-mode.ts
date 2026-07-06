"use client"

import { useEnvironment } from "./use-environment"
import { useMinWidth } from "./use-breakpoint"

/**
 * The resolved layout mode = environment (first) × breakpoint (second).
 *
 *  - "miniapp":     inside Telegram → always the calm mobile mini-app shell,
 *                   regardless of Telegram Desktop's wide window.
 *  - "web-mobile":  plain browser, below lg → mobile-first storefront.
 *  - "web-desktop": plain browser, lg+ → the real marketplace dashboard
 *                   (fixed RTL sidebar, professional header, multi-column).
 *
 * NOTE: This is for behavioral logic only. The chrome itself switches via CSS
 * (`tg:` / `web:` + `lg:`), so first paint is always correct with no CLS. This
 * hook returns "miniapp" on the server/first render (safe narrow default).
 */
export type LayoutMode = "miniapp" | "web-mobile" | "web-desktop"

export function useLayoutMode(): LayoutMode {
  const { isTelegram } = useEnvironment()
  const isDesktop = useMinWidth("lg")
  if (isTelegram) return "miniapp"
  return isDesktop ? "web-desktop" : "web-mobile"
}

export function useIsWebDesktop(): boolean {
  return useLayoutMode() === "web-desktop"
}
