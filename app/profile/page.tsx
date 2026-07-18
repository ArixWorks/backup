"use client"

import Link from "next/link"
import useSWR from "swr"
import {
  Bell, ChevronLeft, Crown, Gauge, Gift, Languages, LifeBuoy, LockKeyhole,
  LogOut, Package, ReceiptText, ShieldCheck, Sparkles, Undo2, User as UserIcon,
  UserPlus,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/page-header"
import { MembershipBadge } from "@/components/membership-badge"
import { LanguageSwitcher } from "@/components/language-switcher"
import { MotionQualitySwitcher } from "@/components/motion-quality-switcher"
import { PremiumHeroCard } from "@/components/premium-hero-card"
import { FadeItem, Pressable, Stagger } from "@/components/motion"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import { fetcher } from "@/lib/api-client"
import type { AccountState } from "@/lib/account-types"
import type { RewardsSummary } from "@/components/rewards/vip-tier-card"
import type { MessageKey } from "@/lib/i18n/messages"

type LinkItem = { href: string; label: MessageKey; desc: MessageKey; icon: typeof Package; badge?: number }
type RewardsData = { summary: RewardsSummary | null }

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
  const { data: accountData, isLoading: accountLoading } = useSWR<{ data: AccountState }>(
    user ? "/api/v1/account/state" : null, fetcher, { refreshInterval: 30000 },
  )
  const { data: rewardsData, isLoading: rewardsLoading } = useSWR<{ data: RewardsData }>(
    user ? "/api/v1/rewards" : null, fetcher, { refreshInterval: 30000 },
  )
  const { data: notificationData } = useSWR<{ data: { count: number } }>(
    user ? "/api/v1/notifications/unread" : null, fetcher, { refreshInterval: 20000 },
  )

  if (!user) return null

  const account = accountData?.data
  const rewards = rewardsData?.data?.summary
  const securityChecks = [account?.telegram.connected, account?.email.verified, account?.hasPassword]
  const completedSecurityChecks = securityChecks.filter(Boolean).length
  const securityScore = Math.round((completedSecurityChecks / securityChecks.length) * 100)
  const nextThreshold = rewards?.nextThreshold?.points ?? null
  const loyaltyProgress = nextThreshold
    ? Math.min(100, Math.round((rewards?.lifetimePoints ?? 0) / nextThreshold * 100))
    : rewards ? 100 : 0
  const unreadCount = notificationData?.data?.count ?? 0
  const initials = (user.displayName ?? "?").slice(0, 2)
  const isStaff = user.role === "ADMIN"
  const loading = accountLoading || rewardsLoading
  const links = activityItems.map((item) => item.href === "/notifications" ? { ...item, badge: unreadCount } : item)

  return (
    <Stagger className="flex flex-col gap-5" delay={0.04}>
      <FadeItem><PageHeader icon={UserIcon} title={t("profile.title")} /></FadeItem>

      <FadeItem>
        <PremiumHeroCard aria-label="مرکز وضعیت حساب" intensity="normal" deviceTilt className="rounded-3xl p-0 sm:p-0">
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="absolute -inset-1 rounded-full border border-primary/35 opacity-70" aria-hidden />
                <Avatar className="size-16 border-2 border-background shadow-lg sm:size-20">
                  {user.photoUrl ? <AvatarImage src={user.photoUrl} alt={user.displayName ?? ""} /> : null}
                  <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">{initials}</AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 end-0 size-4 rounded-full border-2 border-card bg-primary" aria-label="حساب فعال" />
              </div>
              <div className="min-w-0 flex-1">
                <p dir="auto" className="truncate text-xl font-extrabold text-foreground sm:text-2xl">{user.displayName}</p>
                {user.alias ? <p dir="ltr" className="truncate text-sm text-muted-foreground">@{user.alias}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <MembershipBadge tier={user.membership.tier} />
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-primary" /> حساب فعال
                  </span>
                </div>
              </div>
              <Link href="/account" className="hidden rounded-xl border border-border/70 bg-background/55 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary sm:inline-flex">
                مدیریت حساب
              </Link>
            </div>

            {loading ? <Skeleton className="h-28 w-full rounded-2xl" /> : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatusCard href="/account" icon={LockKeyhole} label="امنیت حساب" value={`${securityScore.toLocaleString("fa-IR")}٪`} progress={securityScore} hint={securityScore === 100 ? "همه روش‌ها تکمیل است" : `${(3 - completedSecurityChecks).toLocaleString("fa-IR")} اقدام باقی مانده`} />
                <StatusCard href="/rewards" icon={Sparkles} label="امتیاز قابل استفاده" value={(rewards?.loyaltyPoints ?? 0).toLocaleString("fa-IR")} progress={loyaltyProgress} hint={rewards?.nextTierLabel ? `تا سطح ${rewards.nextTierLabel}` : "بالاترین سطح عضویت"} />
                <StatusCard href="/notifications" icon={Bell} label="نیازمند توجه" value={unreadCount.toLocaleString("fa-IR")} progress={unreadCount ? 35 : 100} hint={unreadCount ? "اعلان خوانده‌نشده" : "همه‌چیز مرتب است"} />
              </div>
            )}
          </div>
        </PremiumHeroCard>
      </FadeItem>

      <FadeItem>
        <div className="grid grid-cols-1 items-start gap-5 web:lg:grid-cols-2">
          <LinkGroup items={accountItems} />
          <LinkGroup items={links.concat(isStaff ? [{ href: "/admin", label: "menu.admin", desc: "menu.adminDesc", icon: ShieldCheck }] : [])} />
        </div>
      </FadeItem>

      <FadeItem>
        <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-label="تنظیمات تجربه کاربری">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><Languages className="size-4" />{t("profile.language")}</span>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground"><Gauge className="size-4" />{t("profile.motion")}</span>
            <MotionQualitySwitcher />
          </div>
        </section>
      </FadeItem>

      <FadeItem>
        <Button variant="outline" className="w-full" onClick={() => logout()}>
          <LogOut data-icon="inline-start" />{t("auth.logout")}
        </Button>
      </FadeItem>
    </Stagger>
  )
}

function StatusCard({ href, icon: Icon, label, value, hint, progress }: { href: string; icon: typeof ShieldCheck; label: string; value: string; hint: string; progress: number }) {
  return (
    <Pressable>
      <Link href={href} className="group flex min-h-28 flex-col gap-3 rounded-2xl border border-border/70 bg-background/55 p-4 backdrop-blur-sm transition-colors hover:border-primary/35 hover:bg-secondary/55">
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="size-4 text-primary" />{label}</span>
          <ChevronLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5 rtl:rotate-180" />
        </span>
        <strong className="text-2xl font-black tabular-nums text-foreground">{value}</strong>
        <span className="flex flex-col gap-1.5">
          <span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></span>
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        </span>
      </Link>
    </Pressable>
  )
}

function LinkGroup({ items }: { items: LinkItem[] }) {
  const { t } = useI18n()
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Pressable key={item.href} className="border-b border-border last:border-b-0">
            <Link href={item.href} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary"><Icon className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{t(item.label)}</span><span className="block truncate text-xs text-muted-foreground">{t(item.desc)}</span></span>
              {item.badge ? <span className="min-w-6 rounded-full bg-primary px-2 py-1 text-center text-[11px] font-bold text-primary-foreground">{item.badge.toLocaleString("fa-IR")}</span> : null}
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 rtl:rotate-180" />
            </Link>
          </Pressable>
        )
      })}
    </div>
  )
}
