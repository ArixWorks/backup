"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Save, ClipboardList, Clock } from "lucide-react"
import { ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DeliveryFieldsEditor } from "./delivery-fields-editor"
import { slugifyFieldKey, type DeliveryField } from "@/lib/core/delivery-fields"

/**
 * Self-contained card that configures a product's roadmap / manual-fulfilment
 * behaviour (Phase 3):
 *  - requiresCustomerInput: does the buyer submit account info after paying?
 *  - customerInputFields: the ordered field template the buyer fills in
 *  - avgCompletionMinutes: the estimated fulfilment time (drives the timer)
 *
 * When the toggle is off, the product keeps the instant delivery path and the
 * other inputs are hidden. Persists to Product via the admin PATCH endpoint.
 */
export function CustomerInputCard({
  productId,
  initialEnabled,
  initialFields,
  initialMinutes,
  onSaved,
}: {
  productId: string
  initialEnabled: boolean
  initialFields: DeliveryField[] | null
  initialMinutes: number | null
  onSaved?: () => void
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [fields, setFields] = useState<DeliveryField[]>(initialFields ?? [])
  const [minutes, setMinutes] = useState(initialMinutes ? String(initialMinutes) : "")
  const [saving, setSaving] = useState(false)

  async function save() {
    // Normalize field keys (unique, derived from label) exactly like the
    // delivery-template card so the buyer-facing form has stable keys.
    let normalized: DeliveryField[] | null = null
    if (enabled) {
      const seen = new Set<string>()
      const out: DeliveryField[] = []
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]
        if (!f.label?.fa?.trim()) {
          return toast.error(`برچسب فیلد ردیف ${i + 1} را وارد کنید`)
        }
        let key = f.key?.trim() || slugifyFieldKey(f.label.fa) || `field_${i + 1}`
        if (seen.has(key)) key = `${key}_${i + 1}`
        seen.add(key)
        out.push({ ...f, key })
      }
      normalized = out.length > 0 ? out : null
    }

    const mins = minutes.trim() ? Math.max(1, Math.min(20160, Number(minutes) || 0)) : null

    setSaving(true)
    try {
      const r = await fetch(`/api/v1/admin/products/${productId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requiresCustomerInput: enabled,
          customerInputFields: enabled ? normalized : null,
          avgCompletionMinutes: enabled ? mins : null,
        }),
      })
      if (!r.ok) throw new ApiError((await r.json())?.error?.message ?? "خطا", "ERR", r.status)
      toast.success("تنظیمات نقشه راه ذخیره شد")
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ClipboardList className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="requires-input" className="font-bold">
            نیاز به اطلاعات کاربر (تحویل دستی با نقشه راه)
          </Label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            وقتی روشن باشد، خریدار پس از پرداخت باید اطلاعات حساب خود را وارد کند، سپس سفارش وارد مرحله
            «در حال انجام» با تایمر تخمینی می‌شود تا شما آن را تکمیل کنید. وقتی خاموش باشد، تحویل مثل قبل
            آنی انجام می‌شود.
          </p>
        </div>
        <Switch
          id="requires-input"
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label="نیاز به اطلاعات کاربر"
        />
      </div>

      {enabled && (
        <div className="space-y-4 border-t border-border pt-4">
          <DeliveryFieldsEditor value={fields} onChange={setFields} />

          <div className="space-y-1.5">
            <Label htmlFor="avg-minutes" className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" />
              زمان تخمینی تکمیل (دقیقه)
            </Label>
            <Input
              id="avg-minutes"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              dir="ltr"
              placeholder="مثلاً ۳۰"
              className="w-40 font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              مبنای شمارش معکوس تایمری که به کاربر نمایش داده می‌شود. اگر خالی بماند، تایمر نمایش داده نمی‌شود.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره تنظیمات
        </Button>
      </div>
    </div>
  )
}
