"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { Save, Loader2 } from "lucide-react"
import { fetcher, apiPut } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

type Policy = {
  enabled: boolean
  directInviteNotification: boolean
  secondLevelReward: boolean
  rewardAmount: number
  currency: string
  requireMandatoryChannelMembership: boolean
  notifyInviterAfterChannelVerification: boolean
  activateSecondLevelOnlyAfterChannelVerification: boolean
  requireAntiAbuseApproval: boolean
  blockScoreThreshold: number
  reviewScoreThreshold: number
  flaggedAction: "PENDING_REVIEW" | "BLOCKED"
  minTriggerAccountAgeMin: number
  minBeneficiaryAccountAgeMin: number
  rewardCooldownSec: number
  maxRewardsPerBeneficiaryPerDay: number
  maxPerIpHash: number
  maxPerSubnetHash: number
  maxPerDeviceHash: number
}

const TOGGLES: { key: keyof Policy; label: string; hint: string }[] = [
  { key: "enabled", label: "فعال بودن سیستم دعوت سطح دو", hint: "کلید اصلی موتور پاداش سطح دو" },
  {
    key: "requireMandatoryChannelMembership",
    label: "الزام عضویت در کانال‌های اجباری",
    hint: "دعوت فقط پس از عبور کاربر از گیت عضویت معتبر می‌شود",
  },
  {
    key: "notifyInviterAfterChannelVerification",
    label: "اطلاع به دعوت‌کننده پس از تأیید عضویت",
    hint: "فقط اعلان؛ بدون پاداش",
  },
  {
    key: "activateSecondLevelOnlyAfterChannelVerification",
    label: "فعال‌سازی پاداش سطح دو فقط پس از تأیید عضویت",
    hint: "پاداش سطح دو تنها با عضویت کاربر سطح دو فعال می‌شود",
  },
  { key: "directInviteNotification", label: "اعلان دعوت مستقیم", hint: "دعوت مستقیم پاداشی ندارد" },
  { key: "secondLevelReward", label: "اعطای پاداش سطح دو", hint: "" },
  { key: "requireAntiAbuseApproval", label: "الزام تأیید ضدتقلب", hint: "" },
]

const NUMBERS: { key: keyof Policy; label: string }[] = [
  { key: "rewardAmount", label: "مبلغ پاداش (تومان)" },
  { key: "reviewScoreThreshold", label: "آستانه بررسی دستی (۰ تا ۱۰۰)" },
  { key: "blockScoreThreshold", label: "آستانه مسدودسازی (۰ تا ۱۰۰)" },
  { key: "minTriggerAccountAgeMin", label: "حداقل عمر حساب کاربر محرک (دقیقه)" },
  { key: "minBeneficiaryAccountAgeMin", label: "حداقل عمر حساب دریافت‌کننده (دقیقه)" },
  { key: "rewardCooldownSec", label: "فاصله بین پاداش‌ها (ثانیه)" },
  { key: "maxRewardsPerBeneficiaryPerDay", label: "سقف پاداش روزانه هر کاربر (۰ = نامحدود)" },
  { key: "maxPerDeviceHash", label: "حداکثر دعوت با یک دستگاه" },
  { key: "maxPerIpHash", label: "حداکثر دعوت با یک IP" },
  { key: "maxPerSubnetHash", label: "حداکثر دعوت با یک شبکه" },
]

export function ReferralPolicyEditor() {
  const { data, isLoading, mutate } = useSWR<{ data: Policy }>(
    "/api/v1/admin/referrals/policy",
    fetcher,
  )
  const [draft, setDraft] = useState<Policy | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.data) setDraft(data.data)
  }, [data])

  if (isLoading || !draft) return <Skeleton className="h-96 w-full rounded-xl" />

  function set<K extends keyof Policy>(key: K, value: Policy[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d))
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      await apiPut("/api/v1/admin/referrals/policy", draft)
      toast.success("سیاست دعوت ذخیره شد")
      await mutate()
    } catch {
      toast.error("خطا در ذخیره سیاست")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="font-bold">تنظیمات کلی</h2>
        </header>
        <ul className="divide-y divide-border">
          {TOGGLES.map((t) => (
            <li key={t.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{t.label}</p>
                {t.hint && <p className="text-xs text-muted-foreground">{t.hint}</p>}
              </div>
              <Switch
                checked={draft[t.key] as boolean}
                onCheckedChange={(v) => set(t.key, v as Policy[typeof t.key])}
              />
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">اقدام پیش‌فرض برای موارد مشکوک</p>
              <p className="text-xs text-muted-foreground">وقتی ریسک نامطمئن است</p>
            </div>
            <select
              value={draft.flaggedAction}
              onChange={(e) => set("flaggedAction", e.target.value as Policy["flaggedAction"])}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              <option value="PENDING_REVIEW">بررسی دستی</option>
              <option value="BLOCKED">مسدودسازی</option>
            </select>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="font-bold">مقادیر عددی</h2>
        </header>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          {NUMBERS.map((n) => (
            <div key={n.key} className="space-y-1.5">
              <Label className="text-xs">{n.label}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={String(draft[n.key] as number)}
                onChange={(e) => set(n.key, Number(e.target.value) as Policy[typeof n.key])}
              />
            </div>
          ))}
        </div>
      </section>

      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        ذخیره سیاست
      </Button>
    </div>
  )
}
