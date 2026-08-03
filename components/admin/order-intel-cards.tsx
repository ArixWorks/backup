"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  BadgeCheck,
  Bot,
  Calendar,
  Copy,
  Crown,
  Gavel,
  Globe,
  MailCheck,
  MailX,
  MapPin,
  Monitor,
  Send,
  ShieldAlert,
  Smartphone,
  UserRound,
  Users,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { formatNumber, formatToman } from "@/lib/format"
import { cn } from "@/lib/utils"
import type {
  OrderAccountInfo,
  OrderPurchaseContext,
  OrderSourceView,
} from "@/lib/orders/shared"

const UNKNOWN = "نامشخص"

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("کپی شد")
  } catch {
    toast.error("کپی ناموفق بود")
  }
}

function faDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

/** Whole days since an ISO date, for the "account age" fraud signal. */
function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

// --- Source badge -----------------------------------------------------------

const SOURCE_META: Record<
  OrderSourceView,
  { label: string; Icon: typeof Globe; className: string }
> = {
  WEB: { label: "وب‌سایت", Icon: Globe, className: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  MINI_APP: {
    label: "مینی‌اپ تلگرام",
    Icon: Smartphone,
    className: "bg-primary/10 text-primary",
  },
  BOT: { label: "ربات تلگرام", Icon: Bot, className: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  AUCTION: { label: "مزایده", Icon: Gavel, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
}

export function OrderSourceBadge({ source }: { source: OrderSourceView | null }) {
  if (!source) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
        <Globe className="h-3 w-3" />
        منبع {UNKNOWN}
      </span>
    )
  }
  const { label, Icon, className } = SOURCE_META[source]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// --- Shared row -------------------------------------------------------------

function InfoRow({
  icon: Icon,
  label,
  children,
  copy,
  ltr,
}: {
  icon?: typeof Globe
  label: string
  children: React.ReactNode
  copy?: string
  ltr?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <dt className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {label}
      </dt>
      <dd className={cn("flex min-w-0 items-center gap-1.5 text-sm font-medium", ltr && "font-mono")} dir={ltr ? "ltr" : "auto"}>
        <span className="truncate">{children}</span>
        {copy && (
          <button
            type="button"
            onClick={() => copyText(copy)}
            aria-label={`کپی ${label}`}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </dd>
    </div>
  )
}

// --- Account & Telegram card ------------------------------------------------

export function OrderAccountCard({ account }: { account: OrderAccountInfo | null }) {
  if (!account) return null
  const age = daysSince(account.createdAt)
  const tgUser = account.telegramUsername ? `@${account.telegramUsername.replace(/^@/, "")}` : null

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <UserRound className="h-4 w-4 text-primary" />
        <h2 className="font-bold">حساب و تلگرام کاربر</h2>
        {account.vipManual || account.vipTier === "VIP" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Crown className="h-3 w-3" />
            VIP
          </span>
        ) : null}
        {account.isTestAccount && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            حساب تست
          </span>
        )}
      </div>

      <dl>
        <InfoRow icon={UserRound} label="نام نمایشی">
          {account.displayName || account.alias || UNKNOWN}
        </InfoRow>
        {account.username && (
          <InfoRow label="نام کاربری" copy={account.username} ltr>
            {account.username}
          </InfoRow>
        )}
        <InfoRow
          icon={account.emailVerified ? MailCheck : MailX}
          label="ایمیل"
          copy={account.email ?? undefined}
          ltr
        >
          {account.email ? (
            <span className={account.emailVerified ? "text-success" : undefined}>
              {account.email}
              {!account.emailVerified && <span className="mr-1 text-xs text-muted-foreground"> (تأیید‌نشده)</span>}
            </span>
          ) : (
            UNKNOWN
          )}
        </InfoRow>

        {/* Telegram identity */}
        <InfoRow icon={Send} label="آیدی عددی تلگرام" copy={account.telegramId ?? undefined} ltr>
          {account.telegramId ?? UNKNOWN}
        </InfoRow>
        <InfoRow label="یوزرنیم تلگرام" copy={tgUser ?? undefined} ltr>
          {tgUser ?? UNKNOWN}
        </InfoRow>
        {account.telegramChatId && account.telegramChatId !== account.telegramId && (
          <InfoRow label="شناسه چت" copy={account.telegramChatId} ltr>
            {account.telegramChatId}
          </InfoRow>
        )}
        {account.isPremiumTelegram && (
          <InfoRow icon={BadgeCheck} label="تلگرام پرمیوم">
            <span className="text-primary">دارد</span>
          </InfoRow>
        )}

        {/* Value + trust signals */}
        <InfoRow icon={Crown} label="سطح عضویت">
          {account.vipTier}
          {account.vipManual && <span className="mr-1 text-xs text-muted-foreground"> (دستی)</span>}
        </InfoRow>
        <InfoRow label="مجموع خرید">{formatToman(String(account.totalSpent))} تومان</InfoRow>
        <InfoRow label="امتیاز وفاداری">{formatNumber(account.loyaltyPoints)}</InfoRow>
        <InfoRow icon={Calendar} label="عضویت از">
          {faDateTime(account.createdAt)}
          <span className="mr-1 text-xs text-muted-foreground"> ({formatNumber(age)} روز پیش)</span>
        </InfoRow>
        {account.referredByAlias && (
          <InfoRow icon={Users} label="دعوت‌کننده" ltr>
            {account.referredByAlias}
          </InfoRow>
        )}
      </dl>
    </Card>
  )
}

// --- Purchase context / security card ---------------------------------------

export function OrderContextCard({ context }: { context: OrderPurchaseContext }) {
  const [showUa, setShowUa] = useState(false)
  const { geo } = context
  const location = geo
    ? [geo.city, geo.region, geo.country].filter(Boolean).join("، ") || UNKNOWN
    : UNKNOWN
  const flagged = context.ipAccountCount > 1 || geo?.proxy || geo?.hosting

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className={cn("h-4 w-4", flagged ? "text-destructive" : "text-primary")} />
        <h2 className="font-bold">کانتکست خرید و امنیت</h2>
      </div>

      {/* Fraud banner */}
      {context.ipAccountCount > 1 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            این آی‌پی توسط <strong>{formatNumber(context.ipAccountCount)}</strong> حساب مختلف برای خرید استفاده شده است.
          </span>
        </div>
      )}
      {(geo?.proxy || geo?.hosting) && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>این آی‌پی به‌عنوان {geo?.proxy ? "پروکسی/VPN" : "سرور میزبانی"} شناسایی شده است.</span>
        </div>
      )}

      <dl>
        <InfoRow icon={MapPin} label="آی‌پی خرید" copy={context.ipAddress ?? undefined} ltr>
          {context.ipAddress ?? UNKNOWN}
        </InfoRow>
        <InfoRow icon={Globe} label="لوکیشن">
          {location}
          {geo?.countryCode && <span className="mr-1 text-xs text-muted-foreground"> ({geo.countryCode})</span>}
        </InfoRow>
        {geo?.isp && (
          <InfoRow label="ارائه‌دهنده اینترنت" ltr>
            {geo.isp}
          </InfoRow>
        )}
        <InfoRow icon={Monitor} label="دستگاه / مرورگر">
          {context.userAgent ? (
            <button
              type="button"
              onClick={() => setShowUa((v) => !v)}
              className="text-start text-primary hover:underline"
            >
              {showUa ? context.userAgent : "نمایش جزئیات"}
            </button>
          ) : (
            UNKNOWN
          )}
        </InfoRow>
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        این اطلاعات هنگام خرید و صرفاً برای بررسی تقلب ثبت شده و فقط برای ادمین قابل مشاهده است. سفارش‌های قدیمی ممکن است این داده را نداشته باشند.
      </p>
    </Card>
  )
}
