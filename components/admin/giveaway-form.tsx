"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { fetcher, apiPost, apiPatch, ApiError } from "@/lib/api-client"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ImageUpload } from "@/components/admin/image-upload"

type Channel = { id: string; title: string; url: string }
type PrizeKind = "CUSTOM" | "WALLET" | "COUPON" | "INVENTORY"
type Visibility = "PUBLIC" | "UNLISTED"

export type GiveawayFormValues = {
  title: string
  subtitle: string
  description: string
  coverImage: string
  prizeImage: string
  prizeLabel: string
  prizeKind: PrizeKind
  prizeAmount: string
  prizeProductId: string
  couponType: "PERCENT" | "FIXED"
  couponValue: string
  couponExpiresInDays: string
  winnersCount: string
  requiredChannels: Channel[]
  startAt: string
  endAt: string
  drawAt: string
  visibility: Visibility
  autoDraw: boolean
  internalNotes: string
}

export const emptyGiveaway: GiveawayFormValues = {
  title: "",
  subtitle: "",
  description: "",
  coverImage: "",
  prizeImage: "",
  prizeLabel: "",
  prizeKind: "CUSTOM",
  prizeAmount: "",
  prizeProductId: "",
  couponType: "PERCENT",
  couponValue: "",
  couponExpiresInDays: "",
  winnersCount: "1",
  requiredChannels: [],
  startAt: "",
  endAt: "",
  drawAt: "",
  visibility: "PUBLIC",
  autoDraw: false,
  internalNotes: "",
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  )
}

export function GiveawayForm({
  initial,
  giveawayId,
}: {
  initial: GiveawayFormValues
  giveawayId?: string
}) {
  const router = useRouter()
  const [form, setForm] = useState<GiveawayFormValues>(initial)
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(giveawayId)

  const { data: productsData } = useSWR<{ data: { id: string; title: string }[] }>(
    form.prizeKind === "INVENTORY" ? "/api/v1/admin/products" : null,
    fetcher,
  )
  const products = productsData?.data ?? []

  function set<K extends keyof GiveawayFormValues>(key: K, value: GiveawayFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function addChannel() {
    set("requiredChannels", [...form.requiredChannels, { id: "", title: "", url: "" }])
  }
  function updateChannel(i: number, patch: Partial<Channel>) {
    set(
      "requiredChannels",
      form.requiredChannels.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    )
  }
  function removeChannel(i: number) {
    set(
      "requiredChannels",
      form.requiredChannels.filter((_, idx) => idx !== i),
    )
  }

  function buildPayload(status?: "DRAFT" | "SCHEDULED") {
    const channels = form.requiredChannels
      .map((c) => {
        const url = c.url.trim()
        // Accept bare links (e.g. "t.me/channel") by prefixing a scheme so the
        // value is a valid URL; an empty URL is allowed (no public join link).
        const normalizedUrl = url && !/^https?:\/\//i.test(url) ? `https://${url}` : url
        return { id: c.id.trim(), title: c.title.trim(), url: normalizedUrl }
      })
      .filter((c) => c.id && c.title)
    return {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim() || null,
      coverImage: form.coverImage.trim() || null,
      prizeImage: form.prizeImage.trim() || null,
      prizeLabel: form.prizeLabel.trim(),
      prizeKind: form.prizeKind,
      prizeAmount: form.prizeKind === "WALLET" && form.prizeAmount ? Number(form.prizeAmount) : null,
      prizeProductId: form.prizeKind === "INVENTORY" ? form.prizeProductId || null : null,
      couponType: form.prizeKind === "COUPON" ? form.couponType : null,
      couponValue: form.prizeKind === "COUPON" && form.couponValue ? Number(form.couponValue) : null,
      couponExpiresInDays:
        form.prizeKind === "COUPON" && form.couponExpiresInDays ? Number(form.couponExpiresInDays) : null,
      winnersCount: Number(form.winnersCount) || 1,
      requiredChannels: channels,
      startAt: form.startAt,
      endAt: form.endAt,
      drawAt: form.drawAt,
      visibility: form.visibility,
      autoDraw: form.autoDraw,
      internalNotes: form.internalNotes.trim() || null,
      ...(status ? { status } : {}),
    }
  }

  function validate(): string | null {
    if (form.title.trim().length < 2) return "عنوان الزامی است"
    if (!form.prizeLabel.trim()) return "عنوان جایزه الزامی است"
    if (!form.startAt || !form.endAt || !form.drawAt) return "زمان‌های شروع، پایان و قرعه‌کشی الزامی است"
    if (new Date(form.endAt) <= new Date(form.startAt)) return "زمان پایان باید بعد از شروع باشد"
    if (new Date(form.drawAt) < new Date(form.endAt)) return "زمان قرعه‌کشی باید بعد از پایان ثبت‌نام باشد"
    if (form.prizeKind === "WALLET" && !form.prizeAmount) return "مبلغ جایزه‌ی کیف پول الزامی است"
    if (form.prizeKind === "COUPON" && !form.couponValue) return "مقدار کوپن الزامی است"
    if (form.prizeKind === "INVENTORY" && !form.prizeProductId) return "انتخاب محصول جایزه الزامی است"
    for (const c of form.requiredChannels) {
      const hasAny = c.id.trim() || c.title.trim() || c.url.trim()
      if (hasAny && (!c.id.trim() || !c.title.trim())) {
        return "برای هر کانال اجباری، شناسه و نام نمایشی الزامی است (آدرس اختیاری است)"
      }
    }
    return null
  }

  async function save(publish: boolean) {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await apiPatch(`/api/v1/admin/giveaways/${giveawayId}`, buildPayload())
        if (publish) {
          await apiPost(`/api/v1/admin/giveaways/${giveawayId}/lifecycle`, { action: "publish" })
        }
        toast.success("ذخیره شد")
        router.push(`/admin/giveaways/${giveawayId}`)
      } else {
        const res = await apiPost<{ data: { id: string } }>(
          "/api/v1/admin/giveaways",
          buildPayload(publish ? "SCHEDULED" : "DRAFT"),
        )
        toast.success(publish ? "قرعه‌کشی منتشر شد" : "پیش‌نویس ذخیره شد")
        router.push(`/admin/giveaways/${res.data.id}`)
      }
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="space-y-5 p-5">
      {/* Basics */}
      <div className="space-y-4">
        <Field label="عنوان قرعه‌کشی">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="قرعه‌کشی بزرگ اشتراک ویژه" />
        </Field>
        <Field label="زیرعنوان" hint="یک جمله‌ی کوتاه و جذاب">
          <Input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="فقط با عضویت در کانال شرکت کن!" />
        </Field>
        <Field label="توضیحات">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="تصویر کاور" hint="نسبت ۱۶:۹ پیشنهاد می‌شود">
            <ImageUpload value={form.coverImage} onChange={(v) => set("coverImage", v)} folder="giveaways" aspect="aspect-video" />
          </Field>
          <Field label="تصویر جایزه" hint="اختیاری · مربعی">
            <ImageUpload value={form.prizeImage} onChange={(v) => set("prizeImage", v)} folder="giveaways" aspect="aspect-square" />
          </Field>
        </div>
      </div>

      {/* Prize */}
      <div className="space-y-4 border-t border-border pt-5">
        <h3 className="font-bold">جایزه</h3>
        <Field label="عنوان جایزه">
          <Input value={form.prizeLabel} onChange={(e) => set("prizeLabel", e.target.value)} placeholder="اشتراک یک‌ماهه ویژه" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نوع جایزه">
            <select
              value={form.prizeKind}
              onChange={(e) => set("prizeKind", e.target.value as PrizeKind)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="CUSTOM">دستی (تحویل توسط ادمین)</option>
              <option value="WALLET">اعتبار کیف پول</option>
              <option value="COUPON">کد تخفیف</option>
              <option value="INVENTORY">آیتم موجودی محصول</option>
            </select>
          </Field>
          <Field label="تعداد برندگان">
            <Input value={form.winnersCount} onChange={(e) => set("winnersCount", e.target.value)} inputMode="numeric" dir="ltr" placeholder="1" />
          </Field>
        </div>

        {form.prizeKind === "WALLET" && (
          <Field label="مبلغ اعتبار (تومان)" hint="به‌صورت خودکار به کیف پول برنده واریز می‌شود">
            <Input value={form.prizeAmount} onChange={(e) => set("prizeAmount", e.target.value)} inputMode="numeric" dir="ltr" placeholder="500000" />
          </Field>
        )}

        {form.prizeKind === "COUPON" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="نوع کوپن">
              <select
                value={form.couponType}
                onChange={(e) => set("couponType", e.target.value as "PERCENT" | "FIXED")}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="PERCENT">درصدی</option>
                <option value="FIXED">مبلغ ثابت</option>
              </select>
            </Field>
            <Field label={form.couponType === "PERCENT" ? "درصد" : "مبلغ (تومان)"}>
              <Input value={form.couponValue} onChange={(e) => set("couponValue", e.target.value)} inputMode="numeric" dir="ltr" />
            </Field>
            <Field label="انقضا (روز)" hint="اختیاری">
              <Input value={form.couponExpiresInDays} onChange={(e) => set("couponExpiresInDays", e.target.value)} inputMode="numeric" dir="ltr" placeholder="30" />
            </Field>
          </div>
        )}

        {form.prizeKind === "INVENTORY" && (
          <Field label="محصول جایزه" hint="یک آیتم موجودی از این محصول به هر برنده اختصاص می‌یابد">
            <select
              value={form.prizeProductId}
              onChange={(e) => set("prizeProductId", e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">— انتخاب محصول —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {/* Timing */}
      <div className="space-y-4 border-t border-border pt-5">
        <h3 className="font-bold">زمان‌بندی</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="شروع ثبت‌نام">
            <Input type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} dir="ltr" />
          </Field>
          <Field label="پایان ثبت‌نام">
            <Input type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} dir="ltr" />
          </Field>
          <Field label="زمان قرعه‌کشی">
            <Input type="datetime-local" value={form.drawAt} onChange={(e) => set("drawAt", e.target.value)} dir="ltr" />
          </Field>
        </div>
        <label className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-4 py-3">
          <span className="text-sm">
            <span className="font-semibold">قرعه‌کشی خودکار</span>
            <span className="block text-xs text-muted-foreground">بدون تأیید ادمین در زمان مقرر اجرا شود</span>
          </span>
          <Switch checked={form.autoDraw} onCheckedChange={(v) => set("autoDraw", v)} />
        </label>
      </div>

      {/* Required channels */}
      <div className="space-y-3 border-t border-border pt-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">کانال‌های اجباری</h3>
          <Button type="button" variant="outline" size="sm" onClick={addChannel} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            افزودن
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          شناسه کانال باید با ‎@‎ یا ‎-100…‎ باشد و ربات باید ادمین آن کانال باشد تا عضویت بررسی شود.
        </p>
        {form.requiredChannels.map((c, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input value={c.id} onChange={(e) => updateChannel(i, { id: e.target.value })} dir="ltr" placeholder="@channel یا -100..." />
            <Input value={c.title} onChange={(e) => updateChannel(i, { title: e.target.value })} placeholder="نام نمایشی" />
            <Input value={c.url} onChange={(e) => updateChannel(i, { url: e.target.value })} dir="ltr" placeholder="https://t.me/channel" />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeChannel(i)} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Visibility + notes */}
      <div className="space-y-4 border-t border-border pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="نمایش">
            <select
              value={form.visibility}
              onChange={(e) => set("visibility", e.target.value as Visibility)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="PUBLIC">عمومی (در لیست نمایش داده شود)</option>
              <option value="UNLISTED">فقط با لینک مستقیم</option>
            </select>
          </Field>
          <Field label="یادداشت داخلی" hint="فقط برای ادمین‌ها">
            <Input value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          ذخیره پیش‌نویس
        </Button>
        <Button onClick={() => save(true)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isEdit ? "ذخیره و انتشار" : "انتشار"}
        </Button>
      </div>
    </Card>
  )
}
