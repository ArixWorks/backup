"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { DeliveryFieldsEditor } from "./delivery-fields-editor"
import { slugifyFieldKey, type DeliveryField } from "@/lib/core/delivery-fields"

/**
 * Self-contained card that edits and persists a product's credential field
 * template (Product.deliveryFields). Empty template = default username+password.
 */
export function DeliveryTemplateCard({
  productId,
  initial,
  onSaved,
}: {
  productId: string
  initial: DeliveryField[] | null
  onSaved?: () => void
}) {
  const [fields, setFields] = useState<DeliveryField[]>(initial ?? [])
  const [saving, setSaving] = useState(false)

  async function save() {
    // Ensure every field has a valid machine key before persisting; derive from
    // the label, and guarantee uniqueness.
    const seen = new Set<string>()
    const normalized: DeliveryField[] = []
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i]
      if (!f.label?.fa?.trim()) {
        return toast.error(`برچسب فیلد ردیف ${i + 1} را وارد کنید`)
      }
      let key = f.key?.trim() || slugifyFieldKey(f.label.fa) || `field_${i + 1}`
      if (seen.has(key)) key = `${key}_${i + 1}`
      seen.add(key)
      normalized.push({ ...f, key })
    }

    setSaving(true)
    try {
      const r = await fetch(`/api/v1/admin/products/${productId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deliveryFields: normalized.length > 0 ? normalized : null }),
      })
      if (!r.ok) throw new ApiError((await r.json())?.error?.message ?? "خطا", "ERR", r.status)
      toast.success("قالب فیلدهای تحویل ذخیره شد")
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <DeliveryFieldsEditor value={fields} onChange={setFields} />
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره قالب
        </Button>
      </div>
    </div>
  )
}
