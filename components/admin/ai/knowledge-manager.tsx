"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  FileText,
  Globe,
  Lock,
  AlertCircle,
} from "lucide-react"
import { fetcher, apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const KB_URL = "/api/v1/admin/ai/knowledge"

interface KnowledgeDoc {
  id: string
  title: string
  source: string
  sourceUrl: string | null
  category: string | null
  locale: string
  isPublic: boolean
  status: "READY" | "INDEXING" | "ERROR"
  chunkCount: number
  error: string | null
  updatedAt: string
}

interface DocForm {
  title: string
  content: string
  category: string
  sourceUrl: string
  isPublic: boolean
}

const EMPTY_FORM: DocForm = {
  title: "",
  content: "",
  category: "",
  sourceUrl: "",
  isPublic: true,
}

const STATUS_META: Record<KnowledgeDoc["status"], { label: string; className: string }> = {
  READY: { label: "آماده", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  INDEXING: { label: "در حال نمایه‌سازی", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  ERROR: { label: "خطا", className: "bg-destructive/15 text-destructive" },
}

export function KnowledgeManager() {
  const { data, isLoading } = useSWR<{ data: KnowledgeDoc[] }>(KB_URL, fetcher)
  const docs = data?.data ?? []

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DocForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  async function openEdit(id: string) {
    setEditingId(id)
    setDialogOpen(true)
    setForm(EMPTY_FORM)
    // Load full doc (content isn't in the list payload).
    const full = await apiGet<{ data: KnowledgeDoc & { content: string } }>(`${KB_URL}/${id}`)
    const d = full?.data
    if (d) {
      setForm({
        title: d.title,
        content: d.content,
        category: d.category ?? "",
        sourceUrl: d.sourceUrl ?? "",
        isPublic: d.isPublic,
      })
    }
  }

  async function save() {
    if (form.title.trim().length < 2 || form.content.trim().length < 10) {
      toast.error("عنوان و متن سند را کامل وارد کنید")
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category.trim() || undefined,
        sourceUrl: form.sourceUrl.trim() || "",
        isPublic: form.isPublic,
      }
      if (editingId) {
        await apiPatch(`${KB_URL}/${editingId}`, payload)
        toast.success("سند به‌روزرسانی و بازنمایه‌سازی شد")
      } else {
        await apiPost(KB_URL, payload)
        toast.success("سند ایجاد و نمایه‌سازی شد")
      }
      setDialogOpen(false)
      await mutate(KB_URL)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره سند")
    } finally {
      setSaving(false)
    }
  }

  async function reindex(id: string) {
    setBusyId(id)
    try {
      await apiPatch(`${KB_URL}/${id}`, { reindex: true })
      toast.success("بازنمایه‌سازی انجام شد")
      await mutate(KB_URL)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در بازنمایه‌سازی")
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    if (!confirm("این سند و تمام قطعه‌های آن حذف شوند؟")) return
    setBusyId(id)
    try {
      await apiDelete(`${KB_URL}/${id}`)
      toast.success("سند حذف شد")
      await mutate(KB_URL)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{docs.length} سند</p>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          سند جدید
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-14 text-center">
          <FileText className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">هنوز سندی اضافه نشده است.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {docs.map((doc) => {
            const status = STATUS_META[doc.status]
            return (
              <li
                key={doc.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-foreground">{doc.title}</h3>
                    <Badge variant="secondary" className={status.className}>
                      {status.label}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      {doc.isPublic ? <Globe className="size-3" /> : <Lock className="size-3" />}
                      {doc.isPublic ? "عمومی" : "داخلی"}
                    </Badge>
                    {doc.category ? (
                      <Badge variant="outline">{doc.category}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {doc.chunkCount} قطعه · آخرین به‌روزرسانی{" "}
                    {new Date(doc.updatedAt).toLocaleDateString("fa-IR")}
                  </p>
                  {doc.status === "ERROR" && doc.error ? (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="size-3" />
                      {doc.error}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => reindex(doc.id)}
                    disabled={busyId === doc.id}
                    aria-label="بازنمایه‌سازی"
                  >
                    {busyId === doc.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(doc.id)}
                    aria-label="ویرایش"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(doc.id)}
                    disabled={busyId === doc.id}
                    aria-label="حذف"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش سند" : "سند جدید"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">عنوان</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="مثلاً: سیاست بازپرداخت"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">دسته‌بندی (اختیاری)</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="پرداخت، تحویل، ..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">منبع (اختیاری)</label>
                <Input
                  value={form.sourceUrl}
                  onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
                  placeholder="https://..."
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">متن سند</label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="محتوای کامل سند را اینجا وارد کنید..."
                rows={10}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">قابل استفاده در پشتیبانی</p>
                <p className="text-xs text-muted-foreground">
                  اگر خاموش باشد، فقط برای دستیار داخلی مدیران در دسترس است.
                </p>
              </div>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              انصراف
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editingId ? "ذخیره و بازنمایه‌سازی" : "ایجاد و نمایه‌سازی"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
