"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Settings2, Loader2, Save } from "lucide-react"
import { fetcher, apiPatch, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EnhancedTextarea } from "@/components/rich-content"
import { Skeleton } from "@/components/ui/skeleton"
import { AppearancePicker } from "@/components/admin/appearance-picker"

// Mirror of SETTING_KEYS on the server (lib/core/settings.ts).
const KEYS = {
  // Maintenance mode
  maintenanceEnabled: "maintenance.enabled",
  maintenanceTitle: "maintenance.title",
  maintenanceMessage: "maintenance.message",
  maintenanceSupportUrl: "maintenance.supportUrl",
  cashbackEnabled: "cashback.enabled",
  cashbackPercent: "cashback.percent",
  referralEnabled: "referral.enabled",
  referralReferrerBonus: "referral.referrerBonus",
  referralRefereeBonus: "referral.refereeBonus",
  referralJoinBonus: "referral.joinBonus",
  referralCommissionPercent: "referral.commissionPercent",
  referralMaxPerUser: "referral.maxPerUser",
  referralMinAccountAgeMin: "referral.minAccountAgeMin",
  // Earned-tier thresholds (lifetime points + spend) and per-tier discounts.
  vipBronzePoints: "vip.bronze.points",
  vipSilverPoints: "vip.silver.points",
  vipGoldPoints: "vip.gold.points",
  vipDiamondPoints: "vip.diamond.points",
  vipBronzeSpend: "vip.bronze.spend",
  vipSilverSpend: "vip.silver.spend",
  vipGoldSpend: "vip.gold.spend",
  vipDiamondSpend: "vip.diamond.spend",
  tierDiscountBronze: "tier.discount.bronze",
  tierDiscountSilver: "tier.discount.silver",
  tierDiscountGold: "tier.discount.gold",
  tierDiscountDiamond: "tier.discount.diamond",
  tierDiscountVip: "tier.discount.vip",
  // Top-up payment methods
  payMinToman: "pay.min.toman",
  payCardEnabled: "pay.card.enabled",
  payCardNumber: "pay.card.number",
  payCardHolder: "pay.card.holder",
  payCardBank: "pay.card.bank",
  payUsdtEnabled: "pay.usdt.enabled",
  payUsdtAddress: "pay.usdt.address",
  payUsdtNetwork: "pay.usdt.network",
  payTonEnabled: "pay.ton.enabled",
  payTonAddress: "pay.ton.address",
  payStarsEnabled: "pay.stars.enabled",
} as const

// Earned tiers configured in the admin tier table (VIP discount is separate).
const TIER_ROWS = [
  { id: "Bronze", label: "برنزی", points: "vipBronzePoints", spend: "vipBronzeSpend", discount: "tierDiscountBronze" },
  { id: "Silver", label: "نقره‌ای", points: "vipSilverPoints", spend: "vipSilverSpend", discount: "tierDiscountSilver" },
  { id: "Gold", label: "طلایی", points: "vipGoldPoints", spend: "vipGoldSpend", discount: "tierDiscountGold" },
  { id: "Diamond", label: "دایموند", points: "vipDiamondPoints", spend: "vipDiamondSpend", discount: "tierDiscountDiamond" },
] as const

type Settings = Record<string, string>

export default function AdminSettingsPage() {
  const { data, isLoading, mutate } = useSWR<{ data: Settings }>(
    "/api/v1/admin/settings",
    fetcher,
  )
  const [form, setForm] = useState<Settings>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.data) setForm(data.data)
  }, [data])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      // Persist only the keys this page manages (each mapped from `form`).
      const payload: Settings = {}
      for (const key of Object.values(KEYS)) {
        if (form[key] !== undefined) payload[key] = form[key]
      }
      await apiPatch("/api/v1/admin/settings", payload)
      toast.success("تنظیمات ذخیره شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Settings2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">تنظیمات</h1>
      </div>

      {/* Maintenance mode — blocks non-admins on both the bot and the web/Mini App */}
      <div className="flex items-center gap-2 pt-1">
        <Settings2 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-extrabold">حالت تعمیر و نگهداری</h2>
      </div>

      {isLoading ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : (
        <div
          className={`max-w-xl space-y-5 rounded-xl border p-5 transition-colors ${
            form[KEYS.maintenanceEnabled] === "true"
              ? "border-primary/60 bg-primary/5"
              : "border-border bg-card"
          }`}
        >
          <Toggle
            label="فعال‌سازی حالت تعمیر"
            hint="با فعال شدن، همه کاربران عادی در ربات و وب‌اپ پیام «در حال بروزرسانی» می‌بینند. ادمین اصلی همچنان دسترسی کامل دارد."
            checked={form[KEYS.maintenanceEnabled] === "true"}
            onChange={(v) => set(KEYS.maintenanceEnabled, v)}
          />

          <Field label="عنوان پیام" hint="سرتیتر کوتاه صفحه بروزرسانی">
            <Input
              value={form[KEYS.maintenanceTitle] ?? ""}
              onChange={(e) => set(KEYS.maintenanceTitle, e.target.value)}
              placeholder="به‌زودی برمی‌گردیم"
            />
          </Field>

          <Field label="متن پیام" hint="توضیحی که به کاربران نمایش داده می‌شود">
            <EnhancedTextarea
              minRows={4}
              maxRows={10}
              value={form[KEYS.maintenanceMessage] ?? ""}
              onChange={(v) => set(KEYS.maintenanceMessage, v)}
              placeholder="در حال ارتقای سیستم برای تجربه‌ای بهتر هستیم. لطفاً کمی بعد دوباره سر بزنید."
            />
          </Field>

          <Field label="لینک پشتیبانی (اختیاری)" hint="مثلاً https://t.me/YourSupport — روی دکمه پشتیبانی نمایش داده می‌شود">
            <Input
              inputMode="url"
              value={form[KEYS.maintenanceSupportUrl] ?? ""}
              onChange={(e) => set(KEYS.maintenanceSupportUrl, e.target.value)}
              placeholder="https://t.me/YourSupport"
              className="font-mono"
              dir="ltr"
            />
          </Field>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره
            </Button>
          </div>
        </div>
      )}

      <AppearancePicker />

      <div className="flex items-center gap-2 pt-1">
        <Settings2 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-extrabold">روش‌های شارژ کیف پول</h2>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-5">
          <Field label="حداقل مبلغ شارژ (تومان)" hint="کمترین مبلغی که کاربر می‌تواند شارژ کند">
            <Input
              type="number"
              value={form[KEYS.payMinToman] ?? ""}
              onChange={(e) => set(KEYS.payMinToman, e.target.value)}
              placeholder="10000"
            />
          </Field>

          {/* Card to card */}
          <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
            <Toggle
              label="کارت به کارت"
              hint="پرداخت ریالی و تأیید دستی توسط ادمین"
              checked={form[KEYS.payCardEnabled] === "true"}
              onChange={(v) => set(KEYS.payCardEnabled, v)}
            />
            <Field label="شماره کارت">
              <Input
                inputMode="numeric"
                value={form[KEYS.payCardNumber] ?? ""}
                onChange={(e) => set(KEYS.payCardNumber, e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="6037xxxxxxxxxxxx"
                className="font-mono"
              />
            </Field>
            <Field label="نام صاحب کارت">
              <Input
                value={form[KEYS.payCardHolder] ?? ""}
                onChange={(e) => set(KEYS.payCardHolder, e.target.value)}
                placeholder="نام و نام خانوادگی"
              />
            </Field>
            <Field label="نام بانک">
              <Input
                value={form[KEYS.payCardBank] ?? ""}
                onChange={(e) => set(KEYS.payCardBank, e.target.value)}
                placeholder="مثلاً ملت"
              />
            </Field>
          </div>

          {/* USDT */}
          <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
            <Toggle
              label="تتر (USDT)"
              hint="مبلغ یکتا + تأیید دستی ادمین"
              checked={form[KEYS.payUsdtEnabled] === "true"}
              onChange={(v) => set(KEYS.payUsdtEnabled, v)}
            />
            <Field label="آدرس ولت USDT">
              <Input
                value={form[KEYS.payUsdtAddress] ?? ""}
                onChange={(e) => set(KEYS.payUsdtAddress, e.target.value)}
                placeholder="0x... یا T..."
                className="font-mono"
              />
            </Field>
            <Field label="شبکه" hint="مثلاً BEP20 یا TRC20">
              <Input
                value={form[KEYS.payUsdtNetwork] ?? ""}
                onChange={(e) => set(KEYS.payUsdtNetwork, e.target.value)}
                placeholder="BEP20"
              />
            </Field>
          </div>

          {/* TON */}
          <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
            <Toggle
              label="تون (TON)"
              hint="مبلغ یکتا + تأیید دستی ادمین"
              checked={form[KEYS.payTonEnabled] === "true"}
              onChange={(v) => set(KEYS.payTonEnabled, v)}
            />
            <Field label="آدرس ولت TON">
              <Input
                value={form[KEYS.payTonAddress] ?? ""}
                onChange={(e) => set(KEYS.payTonAddress, e.target.value)}
                placeholder="UQ..."
                className="font-mono"
              />
            </Field>
          </div>

          {/* Telegram Stars */}
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <Toggle
              label="تلگرام استارز"
              hint="پرداخت رسمی و خودکار داخل تلگرام"
              checked={form[KEYS.payStarsEnabled] === "true"}
              onChange={(v) => set(KEYS.payStarsEnabled, v)}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Settings2 className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-extrabold">تنظیمات پاداش‌ها</h2>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-5">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3">
            <div>
              <div className="font-bold">فعال‌سازی کش‌بک</div>
              <div className="text-xs text-muted-foreground">
                بازگشت درصدی از هر خرید به کیف پول خریدار
              </div>
            </div>
            <input
              type="checkbox"
              checked={form[KEYS.cashbackEnabled] === "true"}
              onChange={(e) => set(KEYS.cashbackEnabled, e.target.checked ? "true" : "false")}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3">
            <div>
              <div className="font-bold">فعال‌سازی پاداش دعوت</div>
              <div className="text-xs text-muted-foreground">
                پاداش دعوت‌کننده و دعوت‌شده پس از اولین خرید
              </div>
            </div>
            <input
              type="checkbox"
              checked={form[KEYS.referralEnabled] === "true"}
              onChange={(e) => set(KEYS.referralEnabled, e.target.checked ? "true" : "false")}
              className="h-5 w-5 accent-primary"
            />
          </label>

          <Field label="درصد کش‌بک هر خرید (٪)" hint="درصدی از هر خرید که به کیف پول خریدار برمی‌گردد">
            <Input
              type="number"
              value={form[KEYS.cashbackPercent] ?? ""}
              onChange={(e) => set(KEYS.cashbackPercent, e.target.value)}
              placeholder="2"
            />
          </Field>

          <Field
            label="پاداش دعوت‌کننده (تومان)"
            hint="مبلغی که به دعوت‌کننده پس از اولین خرید کاربر دعوت‌شده پرداخت می‌شود"
          >
            <Input
              type="number"
              value={form[KEYS.referralReferrerBonus] ?? ""}
              onChange={(e) => set(KEYS.referralReferrerBonus, e.target.value)}
              placeholder="50000"
            />
          </Field>

          <Field
            label="پاداش کاربر دعوت‌شده (تومان)"
            hint="مبلغی که به کاربر تازه‌وارد پس از اولین خریدش پرداخت می‌شود"
          >
            <Input
              type="number"
              value={form[KEYS.referralRefereeBonus] ?? ""}
              onChange={(e) => set(KEYS.referralRefereeBonus, e.target.value)}
              placeholder="25000"
            />
          </Field>

          <Field
            label="پاداش عضویت دعوت‌شده (تومان)"
            hint="مرحله اول: مبلغی که به دعوت‌کننده هنگام ورود دوست و عضویت در کانال‌های اجباری پرداخت می‌شود (۰ = غیرفعال)"
          >
            <Input
              type="number"
              value={form[KEYS.referralJoinBonus] ?? ""}
              onChange={(e) => set(KEYS.referralJoinBonus, e.target.value)}
              placeholder="10000"
            />
          </Field>

          <Field
            label="کمیسیون مادام‌العمر (٪)"
            hint="مرحله سوم: درصدی از هر خرید کاربر دعوت‌شده که به‌صورت دائمی به دعوت‌کننده پرداخت می‌شود (۰ = غیرفعال)"
          >
            <Input
              type="number"
              value={form[KEYS.referralCommissionPercent] ?? ""}
              onChange={(e) => set(KEYS.referralCommissionPercent, e.target.value)}
              placeholder="1"
            />
          </Field>

          <div className="space-y-1 border-t border-border pt-4">
            <div className="text-sm font-bold text-foreground">ضدتقلب دعوت</div>
            <div className="text-xs text-muted-foreground">
              محدودیت‌های امنیتی برای جلوگیری از سوءاستفاده از سیستم دعوت
            </div>
          </div>

          <Field
            label="حداکثر دعوت موفق هر کاربر"
            hint="بیشترین تعداد دعوت‌شده که برای هر دعوت‌کننده شمارش می‌شود (۰ = نامحدود)"
          >
            <Input
              type="number"
              value={form[KEYS.referralMaxPerUser] ?? ""}
              onChange={(e) => set(KEYS.referralMaxPerUser, e.target.value)}
              placeholder="0"
            />
          </Field>

          <Field
            label="حداقل سن حساب برای ثبت کد (دقیقه)"
            hint="کاربر باید این مدت از ثبت‌نامش گذشته باشد تا بتواند کد دعوت ثبت کند (۰ = بدون محدودیت)"
          >
            <Input
              type="number"
              value={form[KEYS.referralMinAccountAgeMin] ?? ""}
              onChange={(e) => set(KEYS.referralMinAccountAgeMin, e.target.value)}
              placeholder="0"
            />
          </Field>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-foreground">سطوح عضویت (باشگاه مشتریان)</div>
              <div className="text-xs text-muted-foreground">
                هر سطح با رسیدن به امتیاز مادام‌العمر یا مجموع خرید (هرکدام زودتر) فعال می‌شود. تخفیف
                سطح با کد تخفیف جمع نمی‌شود؛ بیشترین مقدار اعمال می‌شود.
              </div>
            </div>

            {TIER_ROWS.map((row) => (
              <div key={row.id} className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="mb-2.5 text-sm font-bold">{row.label}</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="امتیاز لازم" hint="امتیاز مادام‌العمر">
                    <Input
                      type="number"
                      value={form[KEYS[row.points]] ?? ""}
                      onChange={(e) => set(KEYS[row.points], e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="خرید لازم (تومان)" hint="مجموع خرید">
                    <Input
                      type="number"
                      value={form[KEYS[row.spend]] ?? ""}
                      onChange={(e) => set(KEYS[row.spend], e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="تخفیف (٪)" hint="روی محصولات">
                    <Input
                      type="number"
                      value={form[KEYS[row.discount]] ?? ""}
                      onChange={(e) => set(KEYS[row.discount], e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                </div>
              </div>
            ))}

            <Field
              label="تخفیف عضویت ویژه VIP (٪)"
              hint="تخفیف اعضای VIP که توسط ادمین به‌صورت دستی اعطا می‌شود"
            >
              <Input
                type="number"
                value={form[KEYS.tierDiscountVip] ?? ""}
                onChange={(e) => set(KEYS.tierDiscountVip, e.target.value)}
                placeholder="10"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <div>
        <div className="font-bold">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        className="h-5 w-5 accent-primary"
      />
    </label>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {children}
    </label>
  )
}
