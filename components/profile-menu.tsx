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
  const { t } = useI18n()
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

          {/* Premium identity card. Name direction follows the name itself,
              while account identifiers stay LTR for predictable reading. */}
          <section
            aria-label={user.displayName}
            className={cn(
              "card-premium group relative mb-4 overflow-hidden rounded-3xl border border-primary/20 p-3.5",
              "transition-[border-color,box-shadow,transform] duration-300 ease-out hover:border-primary/35 hover:shadow-[var(--shadow-accent)]",
              !reducedMotion && tier !== "minimal" && "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2",
            )}
            data-state={open ? "open" : "closed"}
          >
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute -end-10 -top-14 h-36 w-36 rounded-full bg-primary/10 blur-3xl transition-transform duration-700 ease-out group-hover:scale-125",
                (reducedMotion || tier === "minimal") && "transition-none",
              )}
            />

            <div className="relative z-[1] flex min-w-0 items-center gap-3.5">
              <div
                className={cn(
                  "relative shrink-0 rounded-full p-0.5 ring-1 ring-primary/40",
                  "shadow-[0_8px_24px_-12px_var(--primary)] transition-[transform,box-shadow] duration-300 ease-out group-hover:scale-[1.035] group-hover:shadow-[0_10px_28px_-10px_var(--primary)]",
                  (reducedMotion || tier === "minimal") && "transition-none group-hover:scale-100",
                )}
              >
                <Avatar className="h-16 w-16 border-2 border-card bg-card sm:h-[4.5rem] sm:w-[4.5rem]">
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
                  <AvatarFallback className="bg-primary/15 text-lg font-extrabold text-primary">
                    {initials(user.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-1 end-1 h-3.5 w-3.5 rounded-full border-[3px] border-card bg-primary shadow-[0_0_12px_var(--primary)]",
                    !reducedMotion && tier === "cinematic" && "animate-pulse",
                  )}
                />
              </div>

              <div className="min-w-0 flex-1 overflow-hidden">
                <bdi
                  dir="auto"
                  className="block w-full truncate text-start text-lg font-extrabold leading-7 text-foreground sm:text-xl"
                  title={user.displayName}
                >
                  {user.displayName}
                </bdi>
                {user.telegramUsername ? (
                  <div className="mt-0.5 truncate text-start text-xs font-medium text-muted-foreground" dir="ltr">
                    @{user.telegramUsername}
                  </div>
                ) : user.email ? (
                  <div className="mt-0.5 truncate text-start text-xs font-medium text-muted-foreground" dir="ltr">
                    {user.email}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="relative z-[2] mt-3 flex items-center justify-end gap-2 border-t border-border/70 pt-3">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? t("menu.unmuteAria") : t("menu.muteAria")}
                title={muted ? t("menu.mutedTitle") : t("menu.unmutedTitle")}
                className={cn(
                  "active:scale-press flex h-11 w-11 items-center justify-center rounded-full border bg-background/70 transition-[color,border-color,background-color,transform] duration-200",
                  muted
                    ? "border-border text-muted-foreground hover:border-primary/35 hover:text-foreground"
                    : "border-primary/30 bg-primary/10 text-primary hover:border-primary/55 hover:bg-primary/15",
                )}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <div className="[&_button]:h-11 [&_button]:w-11 [&_button]:bg-background/70 [&_button]:hover:border-primary/45 [&_button]:hover:text-primary">
                <LanguageSwitcher />
              </div>
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
