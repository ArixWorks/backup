"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import {
  User,
  LogOut,
  ShieldCheck,
  Wallet,
  LifeBuoy,
  ReceiptText,
  Undo2,
  Bell,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronDown,
  Crown,
  Medal,
  Award,
  Trophy,
  Gem,
} from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { LanguageSwitcher } from "@/components/language-switcher"
import { CONTROL_SURFACE } from "@/components/header/control-button"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { fetcher } from "@/lib/api-client"
import { TIER_META, tierLabelKey, type Tier } from "@/lib/tiers"
import { isNotifMuted, setNotifMuted, playNotificationChime, primeAudio } from "@/lib/notification-sound"
import { cn } from "@/lib/utils"

/** Map a tier's logical glyph name to its lucide icon component. */
const TIER_GLYPH = { User, Medal, Award, Trophy, Gem, Crown } as const

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase()
}

type Item = {
  href: string
  label: string
  icon: typeof User
  desc?: string
  tone?: "default" | "primary"
  badge?: number
}

interface NotifResponse {
  ok: boolean
  data: { unread: number }
}

/**
 * Header account control. The avatar opens a bottom-sheet quick-access menu
 * with every important destination (notifications, wallet, deposit reports,
 * support, refunds, account, admin) plus a sound toggle and logout. Built on
 * the Dialog primitive (modal sheet) which is far more reliable inside the
 * Telegram Mini App webview than a popover.
 */
export function ProfileMenu() {
  const { user, logout } = useSession()
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    setMuted(isNotifMuted())
  }, [])

  // Live unread count for the notifications badge (only while signed in).
  const { data: notif } = useSWR<NotifResponse>(
    user ? "/api/v1/notifications?limit=1" : null,
    fetcher,
    { refreshInterval: 20000, revalidateOnFocus: true },
  )
  const unread = notif?.data?.unread ?? 0

  if (!user) return null

  const isStaff = user.role === "ADMIN"

  const tier: Tier = user.membership?.tier ?? "STANDARD"
  const tierMeta = TIER_META[tier]
  const TierGlyph = TIER_GLYPH[tierMeta.glyph]
  const tierLabel = t(tierLabelKey(tier) as Parameters<typeof t>[0])

  const items: Item[] = [
    { href: "/notifications", label: t("menu.notifications"), desc: t("menu.notificationsDesc"), icon: Bell, badge: unread },
    { href: "/wallet", label: t("menu.wallet"), desc: t("menu.walletDesc"), icon: Wallet, tone: "primary" },
    { href: "/reports", label: t("menu.reports"), desc: t("menu.reportsDesc"), icon: ReceiptText },
    { href: "/support", label: t("menu.support"), desc: t("menu.supportDesc"), icon: LifeBuoy },
    { href: "/refunds", label: t("menu.refunds"), desc: t("menu.refundsDesc"), icon: Undo2 },
    { href: "/profile", label: t("menu.profile"), desc: t("menu.profileDesc"), icon: User },
    { href: "/account", label: t("menu.account"), desc: t("menu.accountDesc"), icon: ShieldCheck },
  ]

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  function toggleMute() {
    primeAudio()
    const next = !muted
    setMuted(next)
    setNotifMuted(next)
    if (!next) playNotificationChime() // preview when unmuting
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label={t("menu.accountAria")}
        className={cn(CONTROL_SURFACE, "h-10 gap-2 px-1 min-[480px]:pl-1 min-[480px]:pr-3")}
      >
        {/* Avatar with a luxe gold ring + a tier glyph micro-badge. */}
        <span className="relative shrink-0">
          <Avatar size="default" className="h-8 w-8 ring-1 ring-primary/40">
            {user.photoUrl && <AvatarImage src={user.photoUrl || "/placeholder.svg"} alt={user.displayName} />}
            <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">
              {initials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-card",
              tierMeta.chip,
            )}
          >
            <TierGlyph className="h-2.5 w-2.5" />
          </span>
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-card">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>

        {/* Name + tier — revealed once there's horizontal room. */}
        <span className="hidden min-w-0 flex-col items-start min-[480px]:flex">
          <span className="max-w-[7.5rem] truncate text-sm font-bold leading-tight text-foreground">
            {user.displayName}
          </span>
          <span className={cn("flex items-center gap-1 text-[11px] font-semibold leading-tight", tierMeta.text)}>
            <TierGlyph className="h-3 w-3" />
            {tierLabel}
          </span>
        </span>
        <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground min-[480px]:inline" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-overlay/70 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl rounded-t-3xl border-t border-primary/15 bg-card p-4 pb-safe outline-none",
            "max-h-[85dvh] overflow-y-auto",
            "data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{t("menu.title")}</DialogPrimitive.Title>

          {/* grab handle */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

          {/* identity */}
          <div className="mb-4 flex items-center gap-3">
            <Avatar className="h-12 w-12 border border-primary/30">
              {user.photoUrl && <AvatarImage src={user.photoUrl || "/placeholder.svg"} alt={user.displayName} />}
              <AvatarFallback className="bg-primary/15 font-bold text-primary">
                {initials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-foreground">{user.displayName}</div>
              {user.telegramUsername ? (
                <div className="truncate text-xs text-muted-foreground" dir="ltr">
                  @{user.telegramUsername}
                </div>
              ) : user.email ? (
                <div className="truncate text-xs text-muted-foreground" dir="ltr">
                  {user.email}
                </div>
              ) : null}
            </div>
            {/* preferences: sound toggle + language */}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? t("menu.unmuteAria") : t("menu.muteAria")}
                title={muted ? t("menu.mutedTitle") : t("menu.unmutedTitle")}
                className="active:scale-press flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary/50 text-muted-foreground transition-colors hover:text-foreground"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <LanguageSwitcher />
            </div>
          </div>

          {/* quick links */}
          <nav className="flex flex-col gap-1.5">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => go(item.href)}
                  className={cn(
                    "active:scale-press flex items-center gap-3 rounded-2xl border px-3 py-3 text-right transition-colors",
                    item.tone === "primary"
                      ? "border-primary/30 bg-primary/5 hover:border-primary/50"
                      : "border-border bg-background hover:border-primary/30",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      item.tone === "primary" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.badge && item.badge > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{item.label}</span>
                    {item.desc && (
                      <span className="block truncate text-xs text-muted-foreground">{item.desc}</span>
                    )}
                  </span>
                  <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )
            })}

            {isStaff && (
              <button
                type="button"
                onClick={() => go("/admin")}
                className="active:scale-press flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-right transition-colors hover:border-primary/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{t("menu.admin")}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t("menu.adminDesc")}</span>
                </span>
                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}
          </nav>

          {/* logout */}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              logout()
            }}
            className="active:scale-press mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm font-bold text-destructive transition-colors hover:bg-destructive/15"
          >
            <LogOut className="h-4 w-4" />
            {t("auth.logout")}
          </button>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
