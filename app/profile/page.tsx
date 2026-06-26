"use client"

import { Mail, Send, ShieldCheck, User as UserIcon, Wallet } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function ProfilePage() {
  const { user, logout } = useSession()
  const { t, priceValue, currency } = useI18n()

  if (!user) return null

  const initials = (user.displayName ?? "?").slice(0, 2)

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <UserIcon className="h-5 w-5 text-primary" />
        {t("profile.title")}
      </h1>

      {/* Identity card */}
      <div className="surface-glow flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <Avatar className="h-16 w-16 border border-primary/30">
          {user.photoUrl && <AvatarImage src={user.photoUrl} alt={user.displayName ?? ""} />}
          <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-lg font-extrabold text-foreground">
            {user.displayName}
          </div>
          {user.alias && (
            <div className="truncate text-sm text-muted-foreground" dir="ltr">
              @{user.alias}
            </div>
          )}
        </div>
      </div>

      {/* Wallet shortcut */}
      <Link
        href="/wallet"
        className="active:scale-press flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
      >
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4 text-primary" />
          {t("profile.account")}
        </span>
        <span className="tabular-nums text-sm font-bold text-foreground">
          {priceValue(user.balances?.availableBalance ?? 0)} {currency}
        </span>
      </Link>

      {/* Account details */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Row
          icon={<Send className="h-4 w-4" />}
          label={t("profile.telegram")}
          value={user.telegramUsername ? `@${user.telegramUsername}` : t("profile.notLinked")}
          ltr
        />
        <Row
          icon={<Mail className="h-4 w-4" />}
          label={t("profile.email")}
          value={user.email ?? t("profile.notLinked")}
          ltr
        />
        <Row
          icon={<ShieldCheck className="h-4 w-4" />}
          label={t("profile.role")}
          value={user.role}
        />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {t("profile.language")}
          </span>
          <LanguageSwitcher />
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={() => logout()}>
        {t("auth.logout")}
      </Button>
    </div>
  )
}

function Row({
  icon,
  label,
  value,
  ltr,
}: {
  icon: React.ReactNode
  label: string
  value: string
  ltr?: boolean
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="max-w-[60%] truncate text-sm font-medium text-foreground" dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
    </div>
  )
}
