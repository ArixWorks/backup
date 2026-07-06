"use client"

import { usePathname } from "next/navigation"

/**
 * Storefront browse/detail sections that benefit from a wider, multi-column
 * layout on large screens: the shop/products (`/flash`) and auctions
 * (`/auctions`) areas. Everything else (home hub, wallet, profile, onboarding)
 * keeps the calm, single-column Telegram Mini App width.
 */
const WIDE_PREFIXES = ["/flash", "/auctions"]

/**
 * Returns the responsive `max-width` class for the app shell chrome (header,
 * main, bottom nav) so they always stay perfectly aligned. Mobile keeps the
 * mini-app `max-w-xl`; on `lg` the storefront sections expand to make room for
 * their two-column detail views and denser card grids.
 */
export function useShellWidthClass(): string {
  const pathname = usePathname() ?? ""
  const isWide = WIDE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  return isWide ? "max-w-xl lg:max-w-5xl" : "max-w-xl"
}
