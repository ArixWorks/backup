"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  Sparkles,
  Wand2,
  Boxes,
  GripVertical,
  Pencil,
  X,
} from "lucide-react"
import { fetcher, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { InventoryTotpDialog } from "@/components/admin/products/inventory-totp-dialog"

// A sale plan as returned by the API (BigInt fields serialized to string).
type Variant = {
  id: string
  name: string
  attributes: PlanAttributes | null
  description: string | null
  price: string
  compareAtPrice: string | null
  stock: number
  reservedStock: number
  soldCount: number
  purchaseLimit: number | null
  deliveryType: "MANUAL" | "AUTOMATIC"
  displayOrder: number
  active: boolean
  isDefault: boolean
}

type PlanAttributes = {
  duration?: string | null
  devices?: number | null
  accountType?: "shared" | "private" | null
  credentialsControl?: boolean | null
  twoFactor?: boolean | null
  warranty?: string | null
}

type Draft = {
  name: string
  price: string
  compareAtPrice: string
  stock: string
  purchaseLimit: string
  deliveryType: "MANUAL" | "AUTOMATIC"
  description: string
  duration: string
  devices: string
  accountType: "" | "shared" | "private"
  credentialsControl: boolean
  twoFactor: boolean
  warranty: string
  active: boolean
}

const EMPTY_DRAFT: Draft = {
  name: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  purchaseLimit: "",
  deliveryType: "MANUAL",
  description: "",
  duration: "",
  devices: "",
  accountType: "",
  credentialsControl: false,
  twoFactor: false,
  warranty: "",
  active: true,
}

function toDraft(v: Variant): Draft {
  const a = v.attributes ?? {}
  return {
    name: v.name,
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? "",
    stock: String(v.stock),
    purchaseLimit: v.purchaseLimit != null ? String(v.purchaseLimit) : "",
    deliveryType: v.deliveryType,
    description: v.description ?? "",
    duration: a.duration ?? "",
    devices: a.devices != null ? String(a.devices) : "",
    accountType: a.accountType ?? "",
    credentialsControl: !!a.credentialsControl,
    twoFactor: !!a.twoFactor,
    warranty: a.warranty ?? "",
    active: v.active,
  }
}

function draftToBody(d: Draft) {
  const attributes: PlanAttributes = {
    duration: d.duration.trim() || null,
    devices: d.devices ? Number(d.devices) : null,
    accountType: d.accountType || null,
    credentialsControl: d.credentialsControl,
    twoFactor: d.twoFactor,
    warranty: d.warranty.trim() || null,
  }
  return {
    name: d.name.trim(),
    price: d.price || "0",
    compareAtPrice: d.compareAtPrice ? d.compareAtPrice : null,
    stock: Number(d.stock || 0),
    purchaseLimit: d.purchaseLimit ? Number(d.purchaseLimit) : null,
    deliveryType: d.deliveryType,
    description: d.description.trim() || null,
    attributes,
    active: d.active,
  }
}

function faNum(n: number | string) {
  return Number(n).toLocaleString("fa-IR")
}

export function VariantsEditor({ productId, productTitle }: { productId: string; productTitle: string }) {
  const { data, isLoading, mutate } = useSWR<{ data: Variant[] }>(
    `/api/v1/admin/products/${productId}/variants`,
    fetcher,
  )
  const variants = data?.data ?? []
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <Boxes className="h-4 w-4 text-primary" />
            پلن‌های فروش
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            هر پلن قیمت، موجودی و مخزن اکانت مستقل دارد. مشتری هنگام خرید یکی را انتخاب می‌کند.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AiBuildPlans productId={productId} productTitle={productTitle} onDone={mutate} />
          <Button size="sm" onClick={() => setAdding((v) => !v)} className="gap-1.5">
            {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {adding ? "بستن" : "پلن جدید"}
          </Button>
        </div>
      </div>

      {adding && (
        <VariantForm
          productId={productId}
          productTitle={productTitle}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            void mutate()
          }}
        />
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : variants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          هنوز پلنی تعریف نشده است. با «پلن جدید» یا دستیار هوشمند شروع کنید.
        </div>
      ) : (
        <ul className="space-y-2">
          {variants.map((v) =>
            editingId === v.id ? (
              <li key={v.id}>
                <VariantForm
                  productId={productId}
                  productTitle={productTitle}
                  variant={v}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null)
                    void mutate()
                  }}
                />
              </li>
            ) : (
              <li key={v.id}>
                <VariantRow
                  productId={productId}
                  variant={v}
                  onEdit={() => setEditingId(v.id)}
                  onChanged={mutate}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

function VariantRow({
  productId,
  variant,
  onEdit,
  onChanged,
}: {
  productId: string
  variant: Variant
  onEdit: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const a = variant.attributes ?? {}
  const chips: string[] = []
  if (a.duration) chips.push(a.duration)
  if (a.devices) chips.push(`${faNum(a.devices)} دستگاه`)
  if (a.accountType) chips.push(a.accountType === "private" ? "اختصاصی" : "اشتراکی")
  if (a.warranty) chips.push(`گارانتی ${a.warranty}`)

  async function toggleActive() {
    setBusy(true)
    try {
      await apiPatch(`/api/v1/admin/variants/${variant.id}`, { active: !variant.active })
      onChanged()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا")
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`حذف پلن «${variant.name}»؟`)) return
    setBusy(true)
    try {
      await apiDelete(`/api/v1/admin/variants/${variant.id}`)
      toast.success("پلن حذف شد")
      onChanged()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{variant.name}</span>
          {!variant.active && <Badge variant="secondary">غیرفعال</Badge>}
          {variant.deliveryType === "AUTOMATIC" && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Boxes className="h-3 w-3" /> خودکار
            </Badge>
          )}
        </div>
        {chips.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {chips.map((c) => (
              <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {c}
              </span>
            ))}
          </div>
        )}
        <div className="mt-1 text-xs text-muted-foreground">
          <span className="font-bold text-foreground tabular-nums">{faNum(variant.price)}</span> تومان
          {variant.compareAtPrice && (
            <span className="ms-2 text-muted-foreground line-through tabular-nums">
              {faNum(variant.compareAtPrice)}
            </span>
          )}
          <span className="ms-3">
            موجودی: {faNum(variant.stock - variant.reservedStock)} / {faNum(variant.stock)}
          </span>
          <span className="ms-3">فروش: {faNum(variant.soldCount)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Switch checked={variant.active} onCheckedChange={toggleActive} disabled={busy} aria-label="فعال بودن پلن" />
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="ویرایش">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={remove}
          disabled={busy}
          className="text-muted-foreground hover:text-destructive"
          aria-label="حذف"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function VariantForm({
  productId,
  productTitle,
  variant,
  onCancel,
  onSaved,
}: {
  productId: string
  productTitle: string
  variant?: Variant
  onCancel: () => void
  onSaved: () => void
}) {
  const [d, setD] = useState<Draft>(variant ? toDraft(variant) : EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))
  const digits = (s: string) => s.replace(/[^0-9]/g, "")

  async function aiDescribe() {
    setAiBusy(true)
    try {
      const res = await apiPost<{ data: { name: string; description: string; bullets: string[] } }>(
        "/api/v1/admin/ai/content",
        {
          task: "plan_description",
          productTitle,
          planName: d.name || undefined,
          attributes: {
            duration: d.duration || undefined,
            devices: d.devices ? Number(d.devices) : undefined,
            accountType: d.accountType || undefined,
            credentialsControl: d.credentialsControl,
            twoFactor: d.twoFactor,
            warranty: d.warranty || undefined,
          },
        },
      )
      const out = res.data
      setD((p) => ({
        ...p,
        name: p.name || out.name,
        description: [out.description, ...(out.bullets ?? []).map((b) => `• ${b}`)].join("\n"),
      }))
      toast.success("توضیح پلن ساخته شد")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در تولید")
    } finally {
      setAiBusy(false)
    }
  }

  async function save() {
    if (!d.name.trim()) return toast.error("نام پلن الزامی است")
    setSaving(true)
    try {
      const body = draftToBody(d)
      if (variant) {
        await apiPatch(`/api/v1/admin/variants/${variant.id}`, body)
        toast.success("پلن به‌روزرسانی شد")
      } else {
        await apiPost(`/api/v1/admin/products/${productId}/variants`, body)
        toast.success("پلن اضافه شد")
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>نام پلن</Label>
          <Input
            value={d.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="مثلاً: ۱ ماهه — تک دستگاه"
          />
        </div>
        <div className="space-y-1.5">
          <Label>قیمت (تومان)</Label>
          <Input value={d.price} inputMode="numeric" onChange={(e) => set("price", digits(e.target.value))} className="tabular-nums" />
        </div>
        <div className="space-y-1.5">
          <Label>قیمت قبل از تخفیف (اختیاری)</Label>
          <Input
            value={d.compareAtPrice}
            inputMode="numeric"
            onChange={(e) => set("compareAtPrice", digits(e.target.value))}
            className="tabular-nums"
            placeholder="برای نمایش برچسب تخفیف"
          />
        </div>
        <div className="space-y-1.5">
          <Label>موجودی انبار</Label>
          <Input value={d.stock} inputMode="numeric" onChange={(e) => set("stock", digits(e.target.value))} className="tabular-nums" />
        </div>
        <div className="space-y-1.5">
          <Label>محدودیت خرید هر کاربر (اختیاری)</Label>
          <Input
            value={d.purchaseLimit}
            inputMode="numeric"
            onChange={(e) => set("purchaseLimit", digits(e.target.value))}
            className="tabular-nums"
          />
        </div>
      </div>

      {/* Structured, comparable plan attributes */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">مشخصات پلن (برای جدول مقایسه)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>مدت اشتراک</Label>
            <Input value={d.duration} onChange={(e) => set("duration", e.target.value)} placeholder="مثلاً ۱ ماهه، ۱ ساله" />
          </div>
          <div className="space-y-1.5">
            <Label>تعداد دستگاه</Label>
            <Input value={d.devices} inputMode="numeric" onChange={(e) => set("devices", digits(e.target.value))} className="tabular-nums" />
          </div>
          <div className="space-y-1.5">
            <Label>نوع اکانت</Label>
            <select
              value={d.accountType}
              onChange={(e) => set("accountType", e.target.value as Draft["accountType"])}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">—</option>
              <option value="private">اختصاصی</option>
              <option value="shared">اشتراکی</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>مدت گارانتی (اختیاری)</Label>
            <Input value={d.warranty} onChange={(e) => set("warranty", e.target.value)} placeholder="مثلاً ۷ روزه" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={d.credentialsControl} onCheckedChange={(v) => set("credentialsControl", v)} />
            امکان تغییر رمز
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={d.twoFactor} onCheckedChange={(v) => set("twoFactor", v)} />
            تایید دو مرحله‌ای
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>توضیح پلن</Label>
          <Button type="button" variant="outline" size="sm" onClick={aiDescribe} disabled={aiBusy} className="h-7 gap-1.5 text-xs">
            {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            توضیح با AI
          </Button>
        </div>
        <Textarea value={d.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="ویژگی‌های همین پلن…" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>نوع تحویل</Label>
          <select
            value={d.deliveryType}
            onChange={(e) => set("deliveryType", e.target.value as Draft["deliveryType"])}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="MANUAL">دستی</option>
            <option value="AUTOMATIC">خودکار (از مخزن)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <Switch checked={d.active} onCheckedChange={(v) => set("active", v)} />
          پلن فعال باشد
        </label>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          انصراف
        </Button>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره پلن
        </Button>
      </div>

      {variant && variant.deliveryType === "AUTOMATIC" && (
        <VariantInventory productId={productId} variantId={variant.id} />
      )}
    </div>
  )
}

// AI batch builder: admin types one line, gets a full tiered plan ladder.
function AiBuildPlans({
  productId,
  productTitle,
  onDone,
}: {
  productId: string
  productTitle: string
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [count, setCount] = useState("3")
  const [busy, setBusy] = useState(false)

  async function run() {
    if (prompt.trim().length < 2) return toast.error("توضیح کوتاهی وارد کنید")
    setBusy(true)
    try {
      const res = await apiPost<{
        data: {
          plans: {
            name: string
            description: string
            bullets: string[]
            attributes: PlanAttributes
            suggestedPrice: number | null
          }[]
        }
      }>("/api/v1/admin/ai/content", {
        task: "build_plans",
        productTitle,
        prompt: prompt.trim(),
        count: Number(count),
      })
      const plans = res.data.plans ?? []
      // Persist each proposed plan; ordered as returned.
      let added = 0
      for (let i = 0; i < plans.length; i++) {
        const p = plans[i]
        await apiPost(`/api/v1/admin/products/${productId}/variants`, {
          name: p.name,
          price: p.suggestedPrice != null ? String(p.suggestedPrice) : "0",
          description: [p.description, ...(p.bullets ?? []).map((b) => `• ${b}`)].join("\n"),
          attributes: p.attributes ?? {},
          displayOrder: i,
        })
        added++
      }
      toast.success(`${added.toLocaleString("fa-IR")} پلن ساخته شد`)
      setOpen(false)
      setPrompt("")
      onDone()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ساخت پلن‌ها")
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Wand2 className="h-4 w-4" />
        ساخت با AI
      </Button>
    )
  }

  return (
    <div className="absolute z-10 mt-2 w-72 space-y-2 rounded-lg border border-border bg-popover p-3 shadow-lg">
      <Label className="text-xs">شرح پلن‌ها را بنویسید</Label>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="مثلاً: اشتراک ۱، ۳ و ۱۲ ماهه، اختصاصی، با گارانتی"
      />
      <div className="flex items-center gap-2">
        <Label className="text-xs">تعداد</Label>
        <Input value={count} inputMode="numeric" onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))} className="h-8 w-16 tabular-nums" />
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          بستن
        </Button>
        <Button size="sm" onClick={run} disabled={busy} className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          بساز
        </Button>
      </div>
    </div>
  )
}

// Per-plan credential pool for AUTOMATIC delivery variants.
function VariantInventory({ productId, variantId }: { productId: string; variantId: string }) {
  const { data, isLoading, mutate } = useSWR<{
    data: {
      id: string
      username: string | null
      password: string | null
      licenseKey: string | null
      note: string | null
      capacity?: number
      seatsUsed?: number
      status: string
      hasTotp?: boolean
      totpMaxUses?: number | null
    }[]
  }>(`/api/v1/admin/products/${productId}/inventory?variantId=${variantId}`, fetcher)
  const items = data?.data ?? []
  // Remaining seats across the pool (shared accounts count each free slot).
  const availableSeats = items
    .filter((i) => i.status === "AVAILABLE")
    .reduce((sum, i) => sum + Math.max(0, (i.capacity ?? 1) - (i.seatsUsed ?? 0)), 0)
  const [bulk, setBulk] = useState("")
  const [capacity, setCapacity] = useState("1")
  const [adding, setAdding] = useState(false)

  async function add() {
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return toast.error("حداقل یک خط وارد کنید")
    const cap = Math.max(1, Number(capacity) || 1)
    const parsed = lines.map((line) => {
      if (line.includes(":")) {
        const [username, ...rest] = line.split(":")
        return { username: username.trim(), password: rest.join(":").trim(), capacity: cap }
      }
      return { licenseKey: line, capacity: cap }
    })
    setAdding(true)
    try {
      const res = await apiPost<{ data: { added: number } }>(
        `/api/v1/admin/products/${productId}/inventory`,
        { variantId, items: parsed },
      )
      toast.success(`${res.data.added} آیتم اضافه شد`)
      setBulk("")
      setCapacity("1")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در افزودن")
    } finally {
      setAdding(false)
    }
  }

  async function remove(itemId: string) {
    try {
      await apiDelete(`/api/v1/admin/inventory/${itemId}`)
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف")
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Boxes className="h-3.5 w-3.5 text-primary" /> مخزن اکانت این پلن
        </span>
        <span className="text-[11px] text-muted-foreground">
          {faNum(availableSeats)} ظرفیت آماده از {faNum(items.length)} اکانت
        </span>
      </div>
      <Textarea
        value={bulk}
        onChange={(e) => setBulk(e.target.value)}
        rows={3}
        dir="ltr"
        placeholder={"user1:pass1\nLICENSE-KEY-XXXX"}
        className="font-mono text-xs"
      />
      <div className="mt-2 flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-[11px]">ظرفیت هر اکانت</Label>
          <Input
            value={capacity}
            inputMode="numeric"
            dir="ltr"
            className="h-8 w-24 tabular-nums text-xs"
            onChange={(e) => setCapacity(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </div>
        <p className="pb-1 text-[10px] leading-relaxed text-muted-foreground">
          اکانت اشتراکی؛ چند گیرنده از هر خط. پیش‌فرض ۱.
        </p>
      </div>
      <Button onClick={add} disabled={adding} size="sm" className="mt-2 gap-1.5">
        {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        افزودن به مخزن پلن
      </Button>
      <div className="mt-2 space-y-1">
        {isLoading ? (
          <Skeleton className="h-8 w-full rounded" />
        ) : (
          items.slice(0, 50).map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
              <span className="min-w-0 truncate font-mono text-[11px]" dir="ltr">
                {it.username ? `${it.username}:${it.password ?? ""}` : it.licenseKey || it.note}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                {it.hasTotp && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    2FA
                  </span>
                )}
                {(it.capacity ?? 1) > 1 && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary">
                    {faNum(it.seatsUsed ?? 0)}/{faNum(it.capacity ?? 1)}
                  </span>
                )}
                <InventoryTotpDialog
                  itemId={it.id}
                  hasTotp={Boolean(it.hasTotp)}
                  maxUses={it.totpMaxUses ?? null}
                  onChange={mutate}
                />
                {it.status === "AVAILABLE" && (
                  <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-destructive" aria-label="حذف">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
