"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, Plus, Trash2, Loader2, Save, ArrowUp, ArrowDown, ListChecks } from "lucide-react"
import { apiPatch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const MAX_ITEMS = 12
const MAX_LEN = 120

/**
 * Admin editor for a product's "highlights" — the short, one-line selling
 * points shown as a green checklist on the product page ("ویژگی‌ها"). Works for
 * both fixed-price products and auctions (the PATCH route persists them via a
 * product-level update that doesn't require a FixedSale).
 */
export function HighlightsEditor({
  id,
  initial,
  onSaved,
}: {
  id: string
  initial: string[]
  onSaved: () => void
}) {
  const [items, setItems] = useState<string[]>(initial.length > 0 ? initial : [""])
  const [saving, setSaving] = useState(false)

  function update(index: number, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? value.slice(0, MAX_LEN) : item)))
  }
  function add() {
    setItems((prev) => (prev.length >= MAX_ITEMS ? prev : [...prev, ""]))
  }
  function remove(index: number) {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : [""]
    })
  }
  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function save() {
    const clean = Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, MAX_ITEMS)
    setSaving(true)
    try {
      await apiPatch(`/api/v1/admin/products/${id}`, { highlights: clean })
      toast.success("ویژگی‌ها ذخیره شد")
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا در ذخیره ویژگی‌ها")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">ویژگی‌ها</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        نکات کوتاه و یک‌خطی که قبل از خرید به کاربر نشان داده می‌شوند (حداکثر {MAX_ITEMS} مورد).
      </p>

      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
            <Input
              value={item}
              onChange={(e) => update(index, e.target.value)}
              placeholder="مثلاً: تحویل فوری و خودکار"
              maxLength={MAX_LEN}
              className="flex-1"
            />
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="انتقال به بالا"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="انتقال به پایین"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => remove(index)}
                aria-label="حذف ویژگی"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={items.length >= MAX_ITEMS}>
          <Plus className="h-4 w-4" />
          افزودن ویژگی
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره
        </Button>
      </div>
    </div>
  )
}
