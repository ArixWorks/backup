"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Settings2,
  CreditCard,
  Gift,
  Send,
  Mail,
  ShieldCheck,
  Palette,
  Bot,
  Megaphone,
  Radio,
  DatabaseBackup,
  KeyRound,
  ScrollText,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  GeneralSettingsPanel,
  PaymentSettingsPanel,
  RewardsSettingsPanel,
  AppearanceSettingsPanel,
} from "@/components/admin/settings/general-settings"
import { TwoFactorPanel } from "@/components/admin/settings/two-factor-panel"
import { AuditPanel } from "@/components/admin/settings/audit-panel"
import { BotEditor } from "@/components/admin/bot-editor"
import { ChannelComposer } from "@/components/admin/channel-composer"
import { BroadcastCenter } from "@/components/admin/broadcast-center"
import { EmailManager } from "@/components/admin/email/email-manager"
import { BackupManager } from "@/components/admin/backup-manager"

type TabKey =
  | "general"
  | "payment"
  | "rewards"
  | "telegram"
  | "email"
  | "system"
  | "appearance"

type Tab = { key: TabKey; label: string; icon: LucideIcon; desc: string }

const TABS: Tab[] = [
  { key: "general", label: "عمومی", icon: Settings2, desc: "تعمیر و نگهداری و تنظیمات پایه" },
  { key: "payment", label: "درگاه پرداخت", icon: CreditCard, desc: "روش‌های شارژ کیف پول" },
  { key: "rewards", label: "پاداش‌ها", icon: Gift, desc: "کش‌بک، دعوت و سطوح" },
  { key: "telegram", label: "تلگرام", icon: Send, desc: "ربات، کانال و پیام‌ها" },
  { key: "email", label: "ایمیل", icon: Mail, desc: "قالب‌ها و ارسال ایمیل" },
  { key: "system", label: "سیستم و امنیت", icon: ShieldCheck, desc: "بکاپ، ۲FA و گزارش رویدادها" },
  { key: "appearance", label: "ظاهر", icon: Palette, desc: "تم و ظاهر فروشگاه" },
]

// Sub-tabs inside grouped sections.
const TELEGRAM_SUBS = [
  { key: "bot", label: "تنظیمات ربات", icon: Bot },
  { key: "channel", label: "پست کانال", icon: Radio },
  { key: "broadcasts", label: "مرکز پیام", icon: Megaphone },
] as const

const SYSTEM_SUBS = [
  { key: "backup", label: "پشتیبان‌گیری", icon: DatabaseBackup },
  { key: "twofa", label: "درخواست‌های ۲FA", icon: KeyRound },
  { key: "audit", label: "گزارش رویدادها", icon: ScrollText },
] as const

function isTabKey(v: string | null): v is TabKey {
  return !!v && TABS.some((t) => t.key === v)
}

export function SettingsHub() {
  const router = useRouter()
  const params = useSearchParams()
  const tabParam = params.get("tab")
  const active: TabKey = isTabKey(tabParam) ? tabParam : "general"

  const [telegramSub, setTelegramSub] = useState<(typeof TELEGRAM_SUBS)[number]["key"]>("bot")
  const [systemSub, setSystemSub] = useState<(typeof SYSTEM_SUBS)[number]["key"]>("backup")

  function selectTab(key: TabKey) {
    // Sync to the URL so links (and old-route redirects) can deep-link a tab
    // without a full navigation.
    router.replace(key === "general" ? "/admin/settings" : `/admin/settings?tab=${key}`, { scroll: false })
  }

  const activeTab = TABS.find((t) => t.key === active) ?? TABS[0]

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="rounded-2xl border border-border bg-card p-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon
            const on = t.key === active
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTab(t.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  on ? "bg-primary text-primary-foreground shadow-[0_10px_28px_-14px_var(--primary)]" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Active-tab heading */}
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/12 text-primary">
          <activeTab.icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-foreground">{activeTab.label}</h2>
          <p className="text-xs text-muted-foreground">{activeTab.desc}</p>
        </div>
      </div>

      {/* Panels */}
      {active === "general" && <GeneralSettingsPanel />}
      {active === "payment" && <PaymentSettingsPanel />}
      {active === "rewards" && <RewardsSettingsPanel />}
      {active === "appearance" && <AppearanceSettingsPanel />}
      {active === "email" && <EmailManager />}

      {active === "telegram" && (
        <div className="space-y-5">
          <SubTabBar
            items={TELEGRAM_SUBS}
            active={telegramSub}
            onChange={(k) => setTelegramSub(k as typeof telegramSub)}
          />
          {telegramSub === "bot" && <BotEditor />}
          {telegramSub === "channel" && <ChannelComposer />}
          {telegramSub === "broadcasts" && <BroadcastCenter />}
        </div>
      )}

      {active === "system" && (
        <div className="space-y-5">
          <SubTabBar items={SYSTEM_SUBS} active={systemSub} onChange={(k) => setSystemSub(k as typeof systemSub)} />
          {systemSub === "backup" && <BackupManager />}
          {systemSub === "twofa" && <TwoFactorPanel />}
          {systemSub === "audit" && <AuditPanel />}
        </div>
      )}
    </div>
  )
}

function SubTabBar({
  items,
  active,
  onChange,
}: {
  items: readonly { key: string; label: string; icon: LucideIcon }[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-3">
      {items.map((it) => {
        const Icon = it.icon
        const on = it.key === active
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              on ? "bg-secondary text-foreground ring-1 ring-primary/30" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
