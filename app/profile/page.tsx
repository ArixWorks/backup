"use client"

import Link from "next/link"
import {
  Bell,
  ChevronLeft,
  Crown,
  Gauge,
  Gift,
  Languages,
  LifeBuoy,
  LogOut,
  Package,
  ReceiptText,
  ShieldCheck,
  Undo2,
  User as UserIcon,
  UserPlus,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"
import { PageHeader } from "@/components/page-header"
import { MembershipBadge } from "@/components/membership-badge"
import { LanguageSwitcher } from "@/components/language-switcher"
import { MotionQualitySwitcher } from "@/components/motion-quality-switcher"

type LinkItem = { href: string; label: MessageKey; desc: MessageKey; icon: typeof Package }

// Every profile-owned destination lives here — a single, scannable hub. Wallet
// is intentionally absent: it has its own tab + the header balance pill.
const accountItems: LinkItem[] = [
  { href: "/orders", label: "nav.orders", desc: "svc.ordersDesc", icon: Package },
  { href: "/giveaways", label: "nav.giveaways", desc: "svc.giveawaysDesc", icon: Gift },
  { href: "/rewards", label: "wallet.rewardsTitle", desc: "wallet.rewardsSubtitle", icon: Crown },
  { href: "/invite", label: "invite.title", desc: "invite.subtitle", icon: UserPlus },
]

const activityItems: LinkItem[] = [
  { href: "/notifications", label: "menu.notifications", desc: "menu.notificationsDesc", icon: Bell },
  { href: "/reports", label: "menu.reports", desc: "menu.reportsDesc", icon: ReceiptText },
  { href: "/refunds", label: "menu.refunds", desc: "menu.refundsDesc", icon: Undo2 },
  { href: "/support", label: "menu.support", desc: "menu.supportDesc", icon: LifeBuoy },
  { href: "/account", label: "menu.account", desc: "menu.accountDesc", icon: ShieldCheck },
]

export default function ProfilePage() {
  const { user, logout } = useSession()
  const { t } = useI18n()

  if (!user) return null

  const initials = (user.displayName ?? "?").slice(0, 2)
  const isStaff = user.role === "ADMIN"

  return (
    <div className="space-y-5">
      <PageHeader icon={UserIcon} title={t("profile.title")} />

      {/* Identity */}
      <div className="surface-glow flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <Avatar className="h-16 w-16 border border-primary/30">
          {user.photoUrl && <AvatarImage src={user.photoUrl} alt={user.displayName ?? ""} />}
          <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div dir="auto" className="truncate text-lg font-extrabold text-foreground">
            {user.displayName}
          </div>
          {user.alias && (
            <div className="truncate text-sm text-muted-foreground" dir="ltr">
              @{user.alias}
            </div>
          )}
          <Link href="/rewards" className="mt-2 inline-flex">
            <MembershipBadge tier={user.membership.tier} />
          </Link>
        </div>
      </div>

      {/* Account & activity */}
      <LinkGroup items={accountItems} />
      <LinkGroup items={activityItems.concat(
        isStaff
          ? [{ href: "/admin", label: "menu.admin", desc: "menu.adminDesc", icon: ShieldCheck }]
          : [],
      )} />

      {/* Preferences */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Languages className="h-4 w-4" />
            {t("profile.language")}
          </span>
          <LanguageSwitcher />
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gauge className="h-4 w-4" />
            {t("profile.motion")}
          </span>
          <MotionQualitySwitcher />
        </div>
      </div>

      <Button variant="outline" className="w-full gap-2" onClick={() => logout()}>
        <LogOut className="h-4 w-4" />
        {t("auth.logout")}
      </Button>
    </div>
  )
}

function LinkGroup({ items }: { items: LinkItem[] }) {
  const { t } = useI18n()
  if (items.length === 0) return null
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="active:scale-press flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-secondary/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{t(item.label)}</span>
              <span className="block truncate text-xs text-muted-foreground">{t(item.desc)}</span>
            </span>
            <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          </Link>
        )
      })}
    </div>
  )
}
