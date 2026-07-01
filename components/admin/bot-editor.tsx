"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Loader2,
  Save,
  RotateCcw,
  Send,
  Bot,
  Type,
  MessageSquare,
  SquareMousePointer,
  Smile,
  ToggleRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Globe,
} from "lucide-react"
import { fetcher, apiPut, apiPost } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  TEXT_LABELS,
  BUTTON_LABELS,
  FEATURE_LABELS,
  EMOJI_LABELS,
} from "@/lib/telegram/labels"
import { cn } from "@/lib/utils"

type CustomEmoji = { id: string; fallback: string }
type RequiredChannel = { id: string; title: string; url: string }
type Features = Record<string, boolean>
type ButtonStyle = "primary" | "success" | "danger"

type BotConfig = {
  botName: string
  brandName: string
  emoji: Record<string, string>
  customEmoji: Record<string, CustomEmoji>
  texts: Record<string, string>
  buttons: Record<string, string>
  buttonStyles: Record<string, ButtonStyle>
  buttonEmoji: Record<string, string>
  buttonEmojiAll: string
  defaultLocale: "fa" | "en" | "ru" | "hi"
  usdRate: number
  channelId: string
  requiredChannels: RequiredChannel[]
  botUsername: string
  gateways: { wallet: boolean; binancePay: boolean; usdt: boolean; cryptoBot: boolean }
  features: Features
}

const LOCALE_OPTIONS: { value: BotConfig["defaultLocale"]; label: string }[] = [
  { value: "fa", label: "فارسی (تومان)" },
  { value: "en", label: "English (USD)" },
  { value: "ru", label: "Русский (USD)" },
  { value: "hi", label: "हिन्दी (USD)" },
]

const GATEWAY_OPTIONS: { key: keyof BotConfig["gateways"]; label: string; locked: boolean }[] = [
  { key: "wallet", label: "کیف پول (فعال)", locked: false },
  { key: "binancePay", label: "Binance Pay (به‌زودی)", locked: true },
  { key: "usdt", label: "USDT (به‌زودی)", locked: true },
  { key: "cryptoBot", label: "CryptoBot (به‌زودی)", locked: true },
]

/** Maps to Telegram's fixed button palette (Bot API 9.4 `style`). */
const COLOR_OPTIONS: { value: ButtonStyle | "default"; label: string; swatch: string }[] = [
  { value: "default", label: "پیش‌فرض", swatch: "bg-muted-foreground/40" },
  { value: "primary", label: "آبی", swatch: "bg-blue-500" },
  { value: "success", label: "سبز", swatch: "bg-green-500" },
  { value: "danger", label: "قرمز", swatch: "bg-red-500" },
]

type ConfigResponse = { data: { config: BotConfig; defaults: BotConfig } }
type StatusResponse = {
  data: {
    configured: boolean
    me?: { username?: string; first_name?: string } | null
    webhook?: { url?: string } | null
    appUrl?: string
  }
}

const tabs = [
  { key: "identity", label: "هویت", icon: Bot },
  { key: "texts", label: "متن‌ها", icon: MessageSquare },
  { key: "buttons", label: "دکمه‌ها", icon: SquareMousePointer },
  { key: "emoji", label: "ایموجی", icon: Smile },
  { key: "settings", label: "پیکربندی", icon: Globe },
  { key: "features", label: "قابلیت‌ها", icon: ToggleRight },
]

export function BotEditor() {
  const { data, isLoading, mutate } = useSWR<ConfigResponse>(
    "/api/v1/admin/bot/config",
    fetcher,
  )
  const { data: status, mutate: mutateStatus } = useSWR<StatusResponse>(
    "/api/telegram/setup",
    fetcher,
  )
  const [draft, setDraft] = useState<BotConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("identity")
  const [settingUp, setSettingUp] = useState(false)

  // Seed the draft once the config loads.
  const config = draft ?? data?.data.config ?? null
  const defaults = data?.data.defaults

  function update(mut: (c: BotConfig) => BotConfig) {
    setDraft((prev) => mut(structuredClone(prev ?? data!.data.config)))
  }

  async function save() {
    if (!config) return
    setSaving(true)
    try {
      await apiPut("/api/v1/admin/bot/config", config)
      await mutate()
      setDraft(null)
      toast.success("تنظیمات ربات ذخیره شد")
    } catch (e: any) {
      toast.error(e?.message ?? "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  async function runSetup() {
    setSettingUp(true)
    try {
      const res = await apiPost("/api/telegram/setup", { action: "install" })
      if (res?.data?.webhook?.ok === false) {
        toast.error("ثبت وبهوک ناموفق بود — آدرس عمومی اپ را بررسی کنید")
      } else {
        toast.success("وبهوک، دستورات و دکمه منو با موفقیت تنظیم شد")
        mutateStatus()
      }
    } catch (e: any) {
      toast.error(e?.message ?? "خطا در تنظیم وبهوک")
    } finally {
      setSettingUp(false)
    }
  }

  function resetToDefaults() {
    if (!defaults) return
    setDraft(structuredClone(defaults))
    toast.message("به مقادیر پیش‌فرض بازگشت — برای اعمال، ذخیره کنید")
  }

  if (isLoading || !config) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const dirty = draft !== null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bot className="h-6 w-6 text-primary" />
            تنظیمات ربات تلگرام
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تمام نام‌ها، متن‌ها، دکمه‌ها و ایموجی‌ها را زنده ویرایش کنید. تغییرات بدون نیاز به کد اعمال می‌شوند.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runSetup} disabled={settingUp}>
            {settingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            تنظیم وبهوک
          </Button>
          <Button variant="ghost" size="sm" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4" />
            پیش‌فرض
          </Button>
          <Button size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            ذخیره تغییرات
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary">
          <Sparkles className="h-4 w-4" />
          تغییرات ذخیره‌نشده دارید.
        </div>
      )}

      {status && <ConnectionStatus status={status.data} />}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                <Icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Identity */}
        <TabsContent value="identity" className="mt-4">
          <Card className="space-y-4 p-5">
            <div className="space-y-2">
              <Label>نام فارسی ربات</Label>
              <Input
                value={config.botName}
                onChange={(e) => update((c) => ({ ...c, botName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>نام برند (انگلیسی)</Label>
              <Input
                value={config.brandName}
                onChange={(e) => update((c) => ({ ...c, brandName: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              این نام‌ها در متن‌ها از طریق {"{brand}"} قابل استفاده‌اند و در پیام خوش‌آمد و راهنما نمایش داده می‌شوند.
            </p>
          </Card>
        </TabsContent>

        {/* Texts */}
        <TabsContent value="texts" className="mt-4">
          <div className="grid gap-4">
            {Object.entries(config.texts).map(([key, value]) => (
              <Card key={key} className="space-y-2 p-4">
                <Label className="flex items-center justify-between">
                  <span>{TEXT_LABELS[key] ?? key}</span>
                  <code className="text-[11px] text-muted-foreground" dir="ltr">
                    {key}
                  </code>
                </Label>
                <Textarea
                  rows={value.length > 120 ? 4 : 2}
                  value={value}
                  onChange={(e) =>
                    update((c) => ({ ...c, texts: { ...c.texts, [key]: e.target.value } }))
                  }
                  className="font-mono text-sm leading-relaxed"
                />
              </Card>
            ))}
            <p className="text-xs text-muted-foreground leading-relaxed">
              متغیرها بین {"{}"} قرار می‌گیرند: مثل {"{name}"}، {"{brand}"}، {"{amount}"}، {"{title}"}، {"{price}"} و کلیدهای ایموجی مثل {"{fire}"}.
            </p>
          </div>
        </TabsContent>

        {/* Buttons */}
        <TabsContent value="buttons" className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            رنگ و ایموجی متحرک دکمه‌ها نیازمند نسخه‌ی جدید تلگرام (Bot API 9.4) است. ایموجی متحرک دکمه فقط وقتی نمایش داده می‌شود که مالک ربات اشتراک پرمیوم داشته باشد.
          </p>

          <Card className="space-y-2 border-primary/30 bg-primary/5 p-4">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              ایموجی متحرک برای همه‌ی دکمه‌ها
            </Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              یک شناسه ایموجی متحرک وارد کن تا روی تمام دکمه‌ها اعمال شود. اگر برای دکمه‌ای جداگانه شناسه تعیین کنی، آن مقدار اولویت دارد.
            </p>
            <Input
              placeholder="custom_emoji_id"
              dir="ltr"
              value={config.buttonEmojiAll ?? ""}
              onChange={(e) =>
                update((c) => ({ ...c, buttonEmojiAll: e.target.value.trim() }))
              }
              className="font-mono text-xs"
            />
          </Card>

          <div className="grid gap-3">
            {Object.keys(config.buttons).map((key) => {
              const activeStyle = config.buttonStyles?.[key] ?? "default"
              return (
                <Card key={key} className="space-y-3 p-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center justify-between">
                      <span>{BUTTON_LABELS[key] ?? key}</span>
                      <code className="text-[11px] text-muted-foreground" dir="ltr">
                        {key}
                      </code>
                    </Label>
                    <Input
                      value={config.buttons[key]}
                      onChange={(e) =>
                        update((c) => ({ ...c, buttons: { ...c.buttons, [key]: e.target.value } }))
                      }
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">رنگ:</span>
                    {COLOR_OPTIONS.map((opt) => {
                      const selected = activeStyle === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            update((c) => {
                              const next = { ...c.buttonStyles }
                              if (opt.value === "default") delete next[key]
                              else next[key] = opt.value
                              return { ...c, buttonStyles: next }
                            })
                          }
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
                            selected ? "border-primary bg-primary/10" : "border-border",
                          )}
                        >
                          <span className={cn("h-3 w-3 rounded-full", opt.swatch)} />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">شناسه ایموجی متحرک دکمه (اختیاری)</Label>
                    <Input
                      placeholder="custom_emoji_id"
                      dir="ltr"
                      value={config.buttonEmoji?.[key] ?? ""}
                      onChange={(e) =>
                        update((c) => {
                          const next = { ...c.buttonEmoji }
                          const v = e.target.value.trim()
                          if (v) next[key] = v
                          else delete next[key]
                          return { ...c, buttonEmoji: next }
                        })
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Emoji */}
        <TabsContent value="emoji" className="mt-4 space-y-6">
          <Card className="p-5">
            <h3 className="mb-1 flex items-center gap-2 font-semibold">
              <Smile className="h-4 w-4 text-primary" />
              ایموجی استاندارد
            </h3>
            <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
              این ایموجی‌ها برای کاربران پرمیوم تلگرام به‌صورت خودکار متحرک نمایش داده می‌شوند.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(config.emoji).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Input
                    value={value}
                    onChange={(e) =>
                      update((c) => ({ ...c, emoji: { ...c.emoji, [key]: e.target.value } }))
                    }
                    className="w-16 text-center text-lg"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{EMOJI_LABELS[key] ?? key}</span>
                    <code className="text-[11px] text-muted-foreground" dir="ltr">
                      {"{" + key + "}"}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-1 flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              ایموجی متحرک اختصاصی (Custom Emoji)
            </h3>
            <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
              برای هر کلید می‌توانید یک شناسه ایموجی اختصاصی پرمیوم وارد کنید. در صورت وجود، به‌جای ایموجی استاندارد و به‌صورت کاملاً متحرک نمایش داده می‌شود.
              شناسه را از طریق فوروارد پیام حاوی ایموجی به ربات‌هایی مثل @idstickerbot دریافت کنید.
            </p>
            <div className="grid gap-3">
              {Object.keys(config.emoji).map((key) => {
                const ce = config.customEmoji[key]
                return (
                  <div key={key} className="flex items-center gap-3">
                    <code
                      className="w-20 shrink-0 text-[11px] text-muted-foreground"
                      dir="ltr"
                    >
                      {"{" + key + "}"}
                    </code>
                    <Input
                      placeholder="custom_emoji_id (مثلاً 5368324170671202286)"
                      value={ce?.id ?? ""}
                      dir="ltr"
                      onChange={(e) =>
                        update((c) => {
                          const next = { ...c.customEmoji }
                          if (e.target.value.trim()) {
                            next[key] = { id: e.target.value.trim(), fallback: c.emoji[key] }
                          } else {
                            delete next[key]
                          }
                          return { ...c, customEmoji: next }
                        })
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                )
              })}
            </div>
          </Card>
        </TabsContent>

        {/* Settings: locale, currency, channel, gateways */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="space-y-4 p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <Globe className="h-4 w-4 text-primary" />
              زبان و ارز
            </h3>
            <div className="space-y-2">
              <Label>زبان پیش‌فرض</Label>
              <div className="flex flex-wrap gap-2">
                {LOCALE_OPTIONS.map((opt) => {
                  const selected = config.defaultLocale === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update((c) => ({ ...c, defaultLocale: opt.value }))}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        selected ? "border-primary bg-primary/10 text-primary" : "border-border",
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                زبان فارسی قیمت‌ها را به تومان و سایر زبان‌ها به دلار نمایش می‌دهند.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="usd-rate">نرخ دلار (تومان به ازای هر دلار)</Label>
              <Input
                id="usd-rate"
                type="number"
                dir="ltr"
                value={config.usdRate}
                onChange={(e) =>
                  update((c) => ({ ...c, usdRate: Math.max(1, Number(e.target.value) || 0) }))
                }
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                برای تبدیل قیمت‌های تومانی به دلار در زبان‌های انگلیسی، روسی و هندی استفاده می‌شود.
              </p>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <h3 className="flex items-center gap-2 font-semibold">
              <Send className="h-4 w-4 text-primary" />
              کانال و لینک ربات
            </h3>
            <div className="space-y-2">
              <Label htmlFor="channel-id">آیدی کانال</Label>
              <Input
                id="channel-id"
                dir="ltr"
                placeholder="@mychannel یا -1001234567890"
                value={config.channelId}
                onChange={(e) => update((c) => ({ ...c, channelId: e.target.value.trim() }))}
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                ربات باید ادمین کانال باشد تا بتواند پست ارسال کند.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bot-username">یوزرنیم ربات (برای لینک خرید)</Label>
              <Input
                id="bot-username"
                dir="ltr"
                placeholder="MyShopBot"
                value={config.botUsername}
                onChange={(e) =>
                  update((c) => ({ ...c, botUsername: e.target.value.replace(/^@/, "").trim() }))
                }
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                اگر خالی باشد، هنگام تنظیم وبهوک به‌صورت خودکار از getMe پر می‌شود.
              </p>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 text-primary" />
                عضویت اجباری در کانال‌ها
              </h3>
              <button
                type="button"
                onClick={() =>
                  update((c) => ({
                    ...c,
                    features: { ...c.features, forcedJoin: !c.features.forcedJoin },
                  }))
                }
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  config.features.forcedJoin ? "bg-primary" : "bg-muted",
                )}
                aria-label="فعال‌سازی عضویت اجباری"
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
                    config.features.forcedJoin ? "left-0.5" : "right-0.5",
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              با فعال‌سازی، کاربر قبل از استفاده از ربات باید در همه‌ی کانال‌های زیر عضو شود. اگر بعداً
              از کانالی خارج شود، دسترسی‌اش قطع و دوباره صفحه‌ی عضویت نمایش داده می‌شود. ربات باید در هر
              کانال ادمین باشد تا بتواند عضویت را بررسی کند.
            </p>

            <div className="space-y-3">
              {(config.requiredChannels ?? []).map((ch, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">کانال {i + 1}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() =>
                        update((c) => ({
                          ...c,
                          requiredChannels: c.requiredChannels.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      حذف
                    </Button>
                  </div>
                  <Input
                    dir="ltr"
                    placeholder="@channel یا -1001234567890"
                    value={ch.id}
                    onChange={(e) =>
                      update((c) => {
                        const next = [...c.requiredChannels]
                        next[i] = { ...next[i], id: e.target.value.trim() }
                        return { ...c, requiredChannels: next }
                      })
                    }
                  />
                  <Input
                    placeholder="عنوان دکمه (مثلاً: کانال اصلی)"
                    value={ch.title}
                    onChange={(e) =>
                      update((c) => {
                        const next = [...c.requiredChannels]
                        next[i] = { ...next[i], title: e.target.value }
                        return { ...c, requiredChannels: next }
                      })
                    }
                  />
                  <Input
                    dir="ltr"
                    placeholder="لینک عضویت (برای کانال خصوصی الزامی: https://t.me/+...)"
                    value={ch.url}
                    onChange={(e) =>
                      update((c) => {
                        const next = [...c.requiredChannels]
                        next[i] = { ...next[i], url: e.target.value.trim() }
                        return { ...c, requiredChannels: next }
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                update((c) => ({
                  ...c,
                  requiredChannels: [...(c.requiredChannels ?? []), { id: "", title: "", url: "" }],
                }))
              }
            >
              + افزودن کانال
            </Button>
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="font-semibold">روش‌های پرداخت</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              فعلاً فقط کیف پول فعال است. سایر درگاه‌ها به اتصال واقعی API و کلید نیاز دارند و به‌صورت «به‌زودی» نمایش داده می‌شوند.
            </p>
            <div className="grid gap-2">
              {GATEWAY_OPTIONS.map((g) => {
                const enabled = config.gateways?.[g.key] ?? false
                return (
                  <button
                    key={g.key}
                    type="button"
                    disabled={g.locked}
                    onClick={() =>
                      update((c) => ({
                        ...c,
                        gateways: { ...c.gateways, [g.key]: !c.gateways[g.key] },
                      }))
                    }
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border p-3 text-right transition-colors",
                      enabled ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30",
                      g.locked && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <span className="text-sm font-medium">{g.label}</span>
                    <span
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        enabled ? "bg-primary" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
                          enabled ? "left-0.5" : "right-0.5",
                        )}
                      />
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>
        </TabsContent>

        {/* Features */}
        <TabsContent value="features" className="mt-4">
          <div className="grid gap-3">
            {Object.entries(config.features).map(([key, enabled]) => {
              const meta = FEATURE_LABELS[key] ?? { title: key, desc: "" }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    update((c) => ({
                      ...c,
                      features: { ...c.features, [key]: !c.features[key] },
                    }))
                  }
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border p-4 text-right transition-colors",
                    enabled
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-secondary/30",
                  )}
                >
                  <div>
                    <div className="font-medium">{meta.title}</div>
                    <div className="text-xs text-muted-foreground">{meta.desc}</div>
                  </div>
                  <span
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      enabled ? "bg-primary" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all",
                        enabled ? "left-0.5" : "right-0.5",
                      )}
                    />
                  </span>
                </button>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ConnectionStatus({ status }: { status: StatusResponse["data"] }) {
  if (!status.configured) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-destructive">توکن ربات تنظیم نشده است</p>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            متغیر محیطی {"TELEGRAM_BOT_TOKEN"} را در تنظیمات پروژه اضافه کنید تا ربات فعال شود.
          </p>
        </div>
      </div>
    )
  }

  const hasWebhook = Boolean(status.webhook?.url)
  const hasAppUrl = Boolean(status.appUrl)
  const username = status.me?.username ? `@${status.me.username}` : status.me?.first_name || "—"

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">ربات متصل</p>
          <p className="truncate text-sm font-medium" dir="ltr">
            {username}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        {hasWebhook ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">وبهوک</p>
          <p className="text-sm font-medium">{hasWebhook ? "فعال" : "تنظیم نشده"}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <Link2 className={cn("h-5 w-5 shrink-0", hasAppUrl ? "text-success" : "text-warning")} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">آدرس عمومی اپ</p>
          <p className="truncate text-sm font-medium" dir="ltr">
            {hasAppUrl ? status.appUrl : "پس از انتشار (Publish)"}
          </p>
        </div>
      </div>
    </div>
  )
}
