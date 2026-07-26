"use client"

import { useState } from "react"
import useSWR from "swr"
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { apiDelete, apiPatch, apiPost, fetcher } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  displayOrder: number
  active: boolean
  count: number
}

type FormState = { name: string; slug: string; description: string; displayOrder: string; active: boolean }
const emptyForm: FormState = { name: "", slug: "", description: "", displayOrder: "0", active: true }

export default function ProductCategoriesAdminPage() {
  const { data, mutate, isLoading } = useSWR<{ data: Category[] }>("/api/v1/admin/product-categories", fetcher)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function edit(category: Category) {
    setEditingId(category.id)
    setForm({ name: category.name, slug: category.slug, description: category.description ?? "", displayOrder: String(category.displayOrder), active: category.active })
  }

  async function save() {
    if (!form.name.trim() || !form.slug.trim()) return toast.error("نام و شناسه دسته الزامی است")
    setSaving(true)
    const payload = { ...form, displayOrder: Number(form.displayOrder || 0), description: form.description || null }
    try {
      if (editingId) await apiPatch(`/api/v1/admin/product-categories/${editingId}`, payload)
      else await apiPost("/api/v1/admin/product-categories", payload)
      toast.success(editingId ? "دسته‌بندی ویرایش شد" : "دسته‌بندی ساخته شد")
      setEditingId(null)
      setForm(emptyForm)
      await mutate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره دسته‌بندی انجام نشد")
    } finally { setSaving(false) }
  }

  async function remove(category: Category) {
    if (!confirm(`دسته «${category.name}» حذف شود؟ محصولات آن حذف نمی‌شوند و فقط بدون دسته خواهند شد.`)) return
    try {
      await apiDelete(`/api/v1/admin/product-categories/${category.id}`)
      toast.success("دسته‌بندی حذف شد")
      await mutate()
    } catch (error) { toast.error(error instanceof Error ? error.message : "حذف انجام نشد") }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20"><Boxes className="size-5" /></span>
        <div><h1 className="text-2xl font-bold">دسته‌بندی فروشگاه</h1><p className="text-sm text-muted-foreground">ساخت، مرتب‌سازی و فعال‌سازی بخش‌های فروشگاه</p></div>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">{editingId ? "ویرایش دسته" : "دسته جدید"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2"><Label htmlFor="category-name">نام نمایشی</Label><Input id="category-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="اکانت‌های AI" /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="category-slug">شناسه انگلیسی</Label><Input id="category-slug" dir="ltr" value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))} placeholder="ai-accounts" /></div>
          <div className="flex flex-col gap-2 md:col-span-2"><Label htmlFor="category-description">توضیح کوتاه</Label><Textarea id="category-description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="انواع اشتراک و اکانت سرویس‌های هوش مصنوعی" /></div>
          <div className="flex flex-col gap-2"><Label htmlFor="category-order">ترتیب نمایش</Label><Input id="category-order" type="number" min={0} value={form.displayOrder} onChange={(e) => setForm((p) => ({ ...p, displayOrder: e.target.value }))} /></div>
          <label className="flex items-center gap-3 self-end rounded-lg border border-border p-3"><Switch checked={form.active} onCheckedChange={(active) => setForm((p) => ({ ...p, active }))} /><span className="text-sm">نمایش در فروشگاه</span></label>
          <div className="flex gap-2 md:col-span-2"><Button onClick={save} disabled={saving}><Plus data-icon="inline-start" />{editingId ? "ذخیره تغییرات" : "افزودن دسته"}</Button>{editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm) }}>انصراف</Button>}</div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {isLoading ? <p className="text-sm text-muted-foreground">در حال بارگذاری…</p> : data?.data.map((category) => (
          <Card key={category.id} className={!category.active ? "opacity-60" : undefined}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate">{category.name}</strong><span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{category.count} محصول</span></div><p className="mt-1 text-xs text-muted-foreground" dir="ltr">/{category.slug}</p></div>
              <div className="flex shrink-0 gap-2"><Button size="icon" variant="outline" aria-label={`ویرایش ${category.name}`} onClick={() => edit(category)}><Pencil /></Button><Button size="icon" variant="destructive" aria-label={`حذف ${category.name}`} onClick={() => remove(category)}><Trash2 /></Button></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
