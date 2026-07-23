"use client"

import { useState } from "react"
import { GripVertical, Plus, Trash2, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DELIVERY_FIELD_TYPES,
  slugifyFieldKey,
  type DeliveryField,
  type DeliveryFieldType,
} from "@/lib/core/delivery-fields"

const TYPE_LABELS: Record<DeliveryFieldType, string> = {
  text: "متن",
  username: "نام کاربری",
  email: "ایمیل",
  password: "رمز عبور",
  url: "لینک",
  note: "یادداشت (چند خطی)",
  totp: "کلید تایید دو‌مرحله‌ای (۲FA)",
}

/**
 * Ordered credential field-template editor. The admin defines which fields a
 * product/plan delivers (label + type); the per-account values are entered
 * later in the inventory form. Persisted as Product.deliveryFields.
 */
export function DeliveryFieldsEditor({
  value,
  onChange,
}: {
  value: DeliveryField[]
  onChange: (fields: DeliveryField[]) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function update(index: number, patch: Partial<DeliveryField>) {
    onChange(value.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  function updateLabel(index: number, fa: string) {
    const f = value[index]
    // Auto-derive a stable key from the label until the admin renames it.
    const autoKey = !f.key || f.key === slugifyFieldKey(f.label?.fa ?? "")
    update(index, {
      label: { ...f.label, fa },
      key: autoKey ? slugifyFieldKey(fa) || f.key : f.key,
    })
  }

  function add() {
    onChange([
      ...value,
      { key: "", label: { fa: "" }, type: "text", required: true, sensitive: false },
    ])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function reorder(from: number, to: number) {
    if (from === to) return
    const next = [...value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <KeyRound className="h-3.5 w-3.5" />
        قالب فیلدهای تحویل
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        فیلدهای اطلاعات حساب را متناسب با این محصول تعریف کنید (مثلاً ایمیل، رمز، کلید ۲FA). هنگام
        افزودن موجودی یا تحویل، فقط مقدار هر فیلد را وارد می‌کنید. اگر خالی بماند، قالب پیش‌فرض
        «نام کاربری + رمز عبور» استفاده می‌شود.
      </p>

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((f, i) => (
            <li
              key={i}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) reorder(dragIndex, i)
                setDragIndex(null)
              }}
              className="rounded-lg border border-border bg-secondary/40 p-3"
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  aria-label="جابجایی"
                  className="mt-6 cursor-grab text-muted-foreground hover:text-foreground"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">برچسب فیلد</Label>
                    <Input
                      value={f.label?.fa ?? ""}
                      placeholder="مثلاً ایمیل حساب"
                      onChange={(e) => updateLabel(i, e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">نوع</Label>
                    <Select
                      value={f.type}
                      onValueChange={(v) => update(i, { type: v as DeliveryFieldType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_FIELD_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">کلید (انگلیسی)</Label>
                    <Input
                      value={f.key}
                      dir="ltr"
                      placeholder="email"
                      className="font-mono text-xs"
                      onChange={(e) => update(i, { key: slugifyFieldKey(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-end gap-4 pb-1">
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={f.required ?? false}
                        onChange={(e) => update(i, { required: e.target.checked })}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      الزامی
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={f.sensitive ?? false}
                        onChange={(e) => update(i, { sensitive: e.target.checked })}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      حساس (مخفی)
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="حذف فیلد"
                  onClick={() => remove(i)}
                  className="mt-6 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-2">
        <Plus className="h-4 w-4" />
        افزودن فیلد
      </Button>
    </div>
  )
}
