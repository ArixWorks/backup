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
  LifeBuoy,
  ReceiptText,
  Undo2,
  Bell,
  Volume2,
  VolumeX,
  ChevronLeft,
} from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { fetcher } from "@/lib/api-client"
import { isNotifMuted, setNotifMuted, playNotificationChime, primeAudio } from "@/lib/notification-sound"
import { useMotion } from "@/components/motion-provider"
import { cn } from "@/lib/utils"

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
  const { t, dir } = useI18n()
  const { tier, reducedMotion } = useMotion()
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

  const items: Item[] = [
    { href: "/notifications", label: t("menu.notifications"), desc: t("menu.notificationsDesc"), icon: Bell, badge: unread },
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
        className="active:scale-press relative rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Avatar size="default" className="h-9 w-9 ring-1 ring-primary/30">
          {user.photoUrl && <AvatarImage src={user.photoUrl || "/placeholder.svg"} alt={user.displayName} />}
          <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">
            {initials(user.displayName)}
          </AvatarFallback>
        </Avatar>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
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

          {/* Compact identity row: RTL only for Persian, LTR for all other locales. */}
          <section
            aria-label={user.displayName}
            dir={dir}
            className={cn(
              "card-premium group relative mb-4 flex items-center gap-3 overflow-hidden rounded-2xl border border-primary/20 p-3",
              "transition-[border-color,box-shadow] duration-300 ease-out hover:border-primary/35 hover:shadow-[var(--shadow-accent)]",
              !reducedMotion && tier !== "minimal" && "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2",
            )}
            data-state={open ? "open" : "closed"}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                className={cn(
                  "relative shrink-0 rounded-full p-0.5 ring-1 ring-primary/45",
                  "shadow-[0_6px_20px_-10px_var(--primary)] transition-[transform,box-shadow] duration-300 ease-out group-hover:scale-[1.035] group-hover:shadow-[0_8px_24px_-8px_var(--primary)]",
                  (reducedMotion || tier === "minimal") && "transition-none group-hover:scale-100",
                )}
              >
                <Avatar className="h-14 w-14 border-2 border-card bg-card">
                  {user.photoUrl && (
                    <AvatarImage
                      src={user.photoUrl || "/placeholder.svg"}
                      alt={user.displayName}
                      className={cn(
                        "object-cover transition-transform duration-500 ease-out group-hover:scale-105",
                        (reducedMotion || tier === "minimal") && "transition-none group-hover:scale-100",
                      )}
                    />
                  )}
                  <AvatarFallback className="bg-primary/15 text-base font-extrabold text-primary">
                    {initials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-0.5 end-0.5 h-3 w-3 rounded-full border-[2px] border-card bg-primary shadow-[0_0_10px_var(--primary)]",
                    !reducedMotion && tier === "cinematic" && "animate-pulse",
                  )}
                />
              </div>

              <div className={cn("min-w-0 flex-1 overflow-hidden", dir === "rtl" ? "text-right" : "text-left")}>
                <div className="truncate text-base font-extrabold leading-6 text-foreground" title={user.displayName}>
                  {user.displayName}
                </div>
                {user.telegramUsername ? (
                  <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground" dir="ltr">
                    @{user.telegramUsername}
                  </div>
                ) : user.email ? (
                  <div className="mt-0.5 truncate text-xs font-medium text-muted-foreground" dir="ltr">
                    {user.email}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5" dir="ltr">
              <div className="[&_button]:h-10 [&_button]:w-10 [&_button]:bg-background/70 [&_button]:hover:border-primary/45 [&_button]:hover:text-primary">
                <LanguageSwitcher />
              </div>
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? t("menu.unmuteAria") : t("menu.muteAria")}
                title={muted ? t("menu.mutedTitle") : t("menu.unmutedTitle")}
                className={cn(
                  "active:scale-press flex h-10 w-10 items-center justify-center rounded-full border bg-background/70 transition-[color,border-color,background-color,transform] duration-200",
                  muted
                    ? "border-border text-muted-foreground hover:border-primary/35 hover:text-foreground"
                    : "border-primary/30 bg-primary/10 text-primary hover:border-primary/55 hover:bg-primary/15",
                )}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </section>

          {/* quick links */}
          <nav className="flex flex-col gap-1.5">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => go(item.href)}
                  dir={dir}
                  className={cn(
                    "active:scale-press flex items-center gap-3 rounded-2xl border px-3 py-3 text-start transition-colors",
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
                  <ChevronLeft
                    className={cn("h-4 w-4 shrink-0 text-muted-foreground", dir === "ltr" && "rotate-180")}
                  />
                </button>
              )
            })}

            {isStaff && (
              <button
                type="button"
                onClick={() => go("/admin")}
                dir={dir}
                className="active:scale-press flex items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-start transition-colors hover:border-primary/30"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{t("menu.admin")}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t("menu.adminDesc")}</span>
                </span>
                <ChevronLeft
                  className={cn("h-4 w-4 shrink-0 text-muted-foreground", dir === "ltr" && "rotate-180")}
                />
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
