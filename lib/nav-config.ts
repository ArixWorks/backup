import {
  House,
  Store,
  Gavel,
  Wallet,
  User,
  Package,
  Gift,
  UserPlus,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react"
import type { MessageKey } from "@/lib/i18n/messages"

/**
 * Single source of truth for storefront navigation.
 *
 * Both the mobile Bottom Nav and the web-desktop Sidebar consume this config so
 * the two shells can never drift out of sync. `primaryNav` are the five core
 * modules (the bottom-tab set); the sidebar renders these plus `secondaryNav`
 * (tasks that live one level deeper) grouped under section headings.
 */
export type NavItem = {
  href: string
  /** i18n key resolved with the active locale at render time. */
  label: MessageKey
  icon: LucideIcon
  /** Match exactly (used for "/" so it isn't active on every route). */
  exact?: boolean
}

export type NavGroup = {
  /** i18n key for the sidebar section heading. */
  title: MessageKey
  items: NavItem[]
}

/** The five primary modules — identical to the mobile bottom tab bar. */
export const primaryNav: NavItem[] = [
  { href: "/", label: "nav.home", icon: House, exact: true },
  { href: "/flash", label: "nav.flash", icon: Store },
  { href: "/auctions", label: "nav.auctions", icon: Gavel },
  { href: "/wallet", label: "nav.wallet", icon: Wallet },
  { href: "/profile", label: "nav.profile", icon: User },
]

/** Secondary destinations surfaced in the web sidebar (and Profile on mobile). */
export const secondaryNav: NavItem[] = [
  { href: "/orders", label: "nav.orders", icon: Package },
  { href: "/giveaways", label: "nav.giveaways", icon: Gift },
  { href: "/invite", label: "invite.title", icon: UserPlus },
  { href: "/support", label: "support.title", icon: LifeBuoy },
]

/** Grouped structure for the web-desktop sidebar. */
export const sidebarGroups: NavGroup[] = [
  { title: "nav.home", items: primaryNav },
  { title: "nav.orders", items: secondaryNav },
]

/** Active-state matcher shared by both shells. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + "/")
}
