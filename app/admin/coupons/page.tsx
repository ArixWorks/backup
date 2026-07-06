"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Ticket, Loader2, Plus, Trash2, Power } from "lucide-react"
import { fetcher, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatToman } from "@/lib/format"
import {
  CopilotProvider,
  CopilotLauncher,
  useCopilotAdapter,
  type FieldBinding,
} from "@/components/admin/ai/copilot"
import { cn } from "@/lib/utils"
import { useBulkSelection } from "@/lib/hooks/use-bulk-selection"
import { SelectionCheckbox } from "@/components/admin/bulk/selection-checkbox"
import { BulkActionsBar, type BulkDeleteResult } from "@/components/admin/bulk/bulk-actions-bar"

type Coupon = {
  id: string
  code: string
  type: "PERCENT" | "FIXED"
  value: string
  maxDiscount: string | null
  minOrder: string
  perUserLimit: number | null
  totalLimit: number | null
  usedCount: number
  active: boolean
  expiresAt: string | null
}

const empty = {
  code: "",
  type: "PERCENT" as "PERCENT" | "FIXED",
  value: "",
  maxDiscount: "",
  minOrder: "",
  perUserLimit: "",
  totalLimit: "",
  expiresAt: "",
}

export default function AdminCouponsPage() {
  const { data, isLoading, mutate } = useSWR<{ data: Coupon[] }>("/api/v1/admin/coupons", fetcher)
  const [form, setForm] = useState(empty)
  const [creating, setCreating] = useState(false)

  const coupons = data?.data ?? []
  const selection = useBulkSelection(coupons.map((c) => c.id))

  function set<K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function removeSelected(): Promise<BulkDeleteResult> {
    const res = await apiDelete<{ data: BulkDeleteResult }>("/api/v1/admin/coupons", {
      ids: selection.selectedIds,
    })
    return res.data
  }

  const bindings: Record<string, FieldBinding> = {
    code: { get: () => form.code, set: (v) => set("code", String(v ?? "").toUpperCase()) },
    description: { get: () => "", set: () => {}, localized: true },
  }
  const { adapter } = useCopilotAdapter(bindings)

  async function create() {
    if (!form.code.trim() || !form.value) {
      toast.error("کد و مقدار الزامی است")
      return
    }
    setCreating(true)
    try {
      await apiPost("/api/v1/admin/coupons", {
        code: form.code.trim(),
        type: form.type,
        value: Number(form.value),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        minOrder: form.minOrder ? Number(form.minOrder) : 0,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
        totalLimit: form.totalLimit ? Number(form.totalLimit) : null,
        expiresAt: form.expiresAt || null,
      })
      toast.success("کد تخفیف ساخته شد")
      setForm(empty)
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ساخت کد")
    } finally {
      setCreating(false)
    }
  }

  async function toggle(c: Coupon) {
    try {
      await apiPatch(`/api/v1/admin/coupons/${c.id}`, { active: !c.active })
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا")
    }
  }

  async function remove(c: Coupon) {
    if (!confirm(`حذف کد ${c.code}؟`)) return
    try {
      await apiDelete(`/api/v1/admin/coupons/${c.id}`)
      toast.success("حذف شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا")
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Ticket className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">کدهای تخفیف</h1>
      </div>

      {/* Create form */}
      <CopilotProvider entityId="coupon" mode="create" adapter={adapter}>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold">
            <Plus className="h-4 w-4 text-primary" />
            ساخت کد جدید
          </h2>
          <CopilotLauncher />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LabeledInput label="کد" value={form.code} onChange={(v) => set("code", v.toUpperCase())} placeholder="WELCOME20" />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">نوع</span>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as "PERCENT" | "FIXED")}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="PERCENT">درصدی</option>
              <option value="FIXED">مبلغ ثابت</option>
            </select>
          </label>
          <LabeledInput
            label={form.type === "PERCENT" ? "درصد (۱-۱۰۰)" : "مبلغ (تومان)"}
            value={form.value}
            onChange={(v) => set("value", v)}
            type="number"
          />
          {form.type === "PERCENT" && (
            <LabeledInput
              label="سقف تخفیف (تومان)"
              value={form.maxDiscount}
              onChange={(v) => set("maxDiscount", v)}
              type="number"
            />
          )}
          <LabeledInput
            label="حداقل سفارش (تومان)"
            value={form.minOrder}
            onChange={(v) => set("minOrder", v)}
            type="number"
          />
          <LabeledInput
            label="سقف هر کاربر"
            value={form.perUserLimit}
            onChange={(v) => set("perUserLimit", v)}
            type="number"
          />
          <LabeledInput
            label="سقف کل"
            value={form.totalLimit}
            onChange={(v) => set("totalLimit", v)}
            type="number"
          />
          <LabeledInput
            label="تاریخ انقضا"
            value={form.expiresAt}
            onChange={(v) => set("expiresAt", v)}
            type="date"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={create} disabled={creating} className="gap-1.5">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            ساخت
          </Button>
        </div>
      </div>
      </CopilotProvider>

      {/* List */}
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : coupons.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          هنوز کدی ساخته نشده است.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm text-muted-foreground">
            <SelectionCheckbox
              checked={selection.allSelected}
              indeterminate={selection.someSelected}
              onChange={selection.toggleAll}
              label="انتخاب همه"
            />
            انتخاب همه
          </div>
          <ul className="divide-y divide-border">
            {coupons.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 p-4",
                  selection.isSelected(c.id) && "bg-primary/5",
                )}
              >
                <div className="flex items-center gap-3">
                  <SelectionCheckbox
                    checked={selection.isSelected(c.id)}
                    onChange={() => selection.toggle(c.id)}
                    label={`انتخاب ${c.code}`}
                  />
                  <span className="rounded-md bg-secondary px-2 py-1 font-mono text-sm font-bold">
                    {c.code}
                  </span>
                  <span className="text-sm">
                    {c.type === "PERCENT"
                      ? `${c.value}٪${c.maxDiscount ? ` تا ${formatToman(Number(c.maxDiscount))}` : ""}`
                      : formatToman(Number(c.value))}
                  </span>
                  {!c.active && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                      غیرفعال
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    استفاده: <strong className="text-foreground tabular-nums">{c.usedCount}</strong>
                    {c.totalLimit ? ` / ${c.totalLimit}` : ""}
                  </span>
                  {Number(c.minOrder) > 0 && <span>حداقل: {formatToman(Number(c.minOrder))}</span>}
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-secondary"
                  >
                    <Power className="h-3.5 w-3.5" />
                    {c.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BulkActionsBar
        count={selection.count}
        itemNoun="کد تخفیف"
        onDelete={removeSelected}
        onClear={selection.clear}
        onDone={mutate}
      />
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold">{label}</span>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  )
}
