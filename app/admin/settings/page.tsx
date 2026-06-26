"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Settings2, Loader2, Save } from "lucide-react"
import { fetcher, apiPatch, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

// Mirror of SETTING_KEYS on the server (lib/core/settings.ts).
const KEYS = {
  cashbackEnabled: "cashback.enabled",
  cashbackPercent: "cashback.percent",
  referralEnabled: "referral.enabled",
  referralReferrerBonus: "referral.referrerBonus",
  referralRefereeBonus: "referral.refereeBonus",
  referralJoinBonus: "referral.joinBonus",
  referralCommissionPercent: "referral.commissionPercent",
  referralMaxPerUser: "referral.maxPerUser",
  referralMinAccountAgeMin: "referral.minAccountAgeMin",
} as const

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
      await apiPatch("/api/v1/admin/settings", {
        [KEYS.cashbackEnabled]: form[KEYS.cashbackEnabled],
        [KEYS.cashbackPercent]: form[KEYS.cashbackPercent],
        [KEYS.referralEnabled]: form[KEYS.referralEnabled],
        [KEYS.referralReferrerBonus]: form[KEYS.referralReferrerBonus],
        [KEYS.referralRefereeBonus]: form[KEYS.referralRefereeBonus],
        [KEYS.referralJoinBonus]: form[KEYS.referralJoinBonus],
        [KEYS.referralCommissionPercent]: form[KEYS.referralCommissionPercent],
        [KEYS.referralMaxPerUser]: form[KEYS.referralMaxPerUser],
        [KEYS.referralMinAccountAgeMin]: form[KEYS.referralMinAccountAgeMin],
      })
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
        <h1 className="text-2xl font-extrabold">تنظیمات پاداش‌ها</h1>
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
