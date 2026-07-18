"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Save, Send, Archive, ImageIcon, X, ArrowRight, Loader2 } from "lucide-react"
import { apiPost, apiPatch } from "@/lib/api-client"
import { RichContentEditor, MediaManager, type MediaAssetDTO } from "@/components/rich-content"
import type { SerializedTypeDef } from "@/lib/cms/serialize"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { RelationPicker, type RelationItem } from "./relation-picker"
import { VersionHistory } from "./version-history"
import { ContentFields } from "./content-fields"

type RelationRow = {
  targetType: string
  targetId: string
  relationKey: string
  order: number
  label?: string
  thumb?: string | null
}

interface InitialContent {
  id: string
  title: string
  slug: string
  excerpt: string | null
  body: string
  status: string
  scheduledFor: string | null
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string[]
  coverImageUrl: string | null
  fields: Record<string, unknown>
  navShow: boolean
  navLabel: string | null
  navIcon: string | null
  navOrder: number
  navPlacement: string[]
  breadcrumbLabel: string | null
  relations?: RelationRow[]
  tags?: { id: string; name: string }[]
}

const PLACEMENTS: { value: string; label: string }[] = [
  { value: "HEADER", label: "هدر" },
  { value: "FOOTER", label: "فوتر" },
  { value: "SIDEBAR", label: "سایدبار" },
]

export function ContentEditor({
  def,
  contentId,
  initial,
}: {
  def: SerializedTypeDef
  contentId?: string
  initial?: InitialContent
}) {
  const router = useRouter()
  const isEdit = Boolean(contentId)

  const [title, setTitle] = useState(initial?.title ?? "")
  const [slug, setSlug] = useState(initial?.slug ?? "")
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "")
  const [body, setBody] = useState(initial?.body ?? "")
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.coverImageUrl ?? "")
  const [fields, setFields] = useState<Record<string, unknown>>(initial?.fields ?? {})
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).map((t) => t.name).join("، "))

  // SEO
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "")
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "")

  // Navigation
  const [navShow, setNavShow] = useState(initial?.navShow ?? def.navigation.defaultShow)
  const [navLabel, setNavLabel] = useState(initial?.navLabel ?? "")
  const [navOrder, setNavOrder] = useState(initial?.navOrder ?? 0)
  const [navPlacement, setNavPlacement] = useState<string[]>(
    initial?.navPlacement ?? def.navigation.defaultPlacement,
  )

  // Relations: group initial rows by relationKey
  const [relations, setRelations] = useState<Record<string, RelationItem[]>>(() => {
    const grouped: Record<string, RelationItem[]> = {}
    for (const slot of def.relations) grouped[slot.key] = []
    for (const r of initial?.relations ?? []) {
      if (!grouped[r.relationKey]) grouped[r.relationKey] = []
      grouped[r.relationKey].push({
        targetType: r.targetType,
        targetId: r.targetId,
        label: r.label,
        thumb: r.thumb,
      })
    }
    return grouped
  })

  const [mediaOpen, setMediaOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const seoForEditor = useMemo(
    () => ({ title: seoTitle || title, metaDescription: seoDescription, keyword: title }),
    [seoTitle, seoDescription, title],
  )

  function buildPayload(status?: string) {
    const relationRows: { relationKey: string; targetType: string; targetId: string }[] = []
    for (const [key, items] of Object.entries(relations)) {
      for (const it of items) {
        relationRows.push({ relationKey: key, targetType: it.targetType, targetId: it.targetId })
      }
    }
    const tagNames = tagsText
      .split(/[،,]/)
      .map((t) => t.trim())
      .filter(Boolean)

    return {
      title: title.trim(),
      slug: slug.trim() || undefined,
      excerpt: excerpt.trim() || null,
      body,
      coverImageUrl: coverImageUrl || null,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      fields,
      tagNames: def.taxonomy.tags ? tagNames : undefined,
      navShow,
      navLabel: navLabel.trim() || null,
      navOrder,
      navPlacement,
      relations: relationRows,
      ...(status ? { status } : {}),
    }
  }

  async function save(status?: string) {
    if (!title.trim()) {
      toast.error("عنوان الزامی است")
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload(status)
      if (isEdit) {
        await apiPatch(`/api/v1/admin/content/${contentId}`, payload)
        toast.success("ذخیره شد")
        router.refresh()
      } else {
        const res = await apiPost<{ data: { id: string } }>(
          `/api/v1/admin/content?type=${def.key}`,
          payload,
        )
        toast.success("ایجاد شد")
        router.push(`/admin/content/${def.key}/${res.data.id}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  function togglePlacement(value: string) {
    setNavPlacement((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value],
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push(`/admin/content/${def.key}`)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-secondary"
          aria-label="بازگشت"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-extrabold">
          {isEdit ? `ویرایش ${def.labelSingular}` : `${def.labelSingular} جدید`}
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-title">عنوان</Label>
            <Input
              id="c-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان محتوا"
              className="text-lg font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-excerpt">خلاصه</Label>
            <Textarea
              id="c-excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              placeholder="خلاصه کوتاه برای فهرست‌ها و سئو"
            />
          </div>

          <div className="space-y-1.5">
            <Label>متن اصلی</Label>
            <RichContentEditor value={body} onChange={setBody} seo={seoForEditor} />
          </div>

          {def.fields.length > 0 && (
            <ContentFields fields={def.fields} values={fields} onChange={setFields} />
          )}

          {def.relations.length > 0 && (
            <div className="glass space-y-4 rounded-2xl border border-border/60 p-4">
              <h3 className="font-bold">ارتباطات</h3>
              {def.relations.map((slot) => (
                <RelationPicker
                  key={slot.key}
                  label={slot.label}
                  help={slot.help}
                  targetType={slot.targetType}
                  multiple={slot.multiple}
                  max={slot.max}
                  value={relations[slot.key] ?? []}
                  onChange={(items) => setRelations((prev) => ({ ...prev, [slot.key]: items }))}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publish controls */}
          <div className="glass space-y-3 rounded-2xl border border-border/60 p-4">
            <h3 className="font-bold">انتشار</h3>
            {initial?.status && (
              <p className="text-xs text-muted-foreground">
                وضعیت فعلی:{" "}
                <span className="font-semibold text-foreground">{statusLabel(initial.status)}</span>
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button onClick={() => save()} disabled={saving} variant="outline" className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                ذخیره پیش‌نویس
              </Button>
              <Button onClick={() => save("PUBLISHED")} disabled={saving} className="gap-1.5">
                <Send className="h-4 w-4" />
                انتشار
              </Button>
              {isEdit && initial?.status === "PUBLISHED" && (
                <Button
                  onClick={() => save("ARCHIVED")}
                  disabled={saving}
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground"
                >
                  <Archive className="h-4 w-4" />
                  بایگانی
                </Button>
              )}
            </div>
            {isEdit && <VersionHistory typeKey={def.key} contentId={contentId!} onRestore={setBody} />}
          </div>

          {/* Slug */}
          <div className="glass space-y-1.5 rounded-2xl border border-border/60 p-4">
            <Label htmlFor="c-slug">نامک (URL)</Label>
            <Input
              id="c-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="به‌صورت خودکار از عنوان ساخته می‌شود"
              dir="ltr"
            />
            <p className="text-[11px] text-muted-foreground" dir="ltr">
              {def.basePath}/{slug || "…"}
            </p>
          </div>

          {/* Cover image */}
          <div className="glass space-y-2 rounded-2xl border border-border/60 p-4">
            <Label>تصویر شاخص</Label>
            {coverImageUrl ? (
              <div className="relative">
                { }
                <img
                  src={coverImageUrl || "/placeholder.svg"}
                  alt="تصویر شاخص"
                  className="aspect-video w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => setCoverImageUrl("")}
                  className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow"
                  aria-label="حذف تصویر"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMediaOpen(true)}
                className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs">انتخاب از کتابخانه</span>
              </button>
            )}
          </div>

          {/* Taxonomy: tags */}
          {def.taxonomy.tags && (
            <div className="glass space-y-1.5 rounded-2xl border border-border/60 p-4">
              <Label htmlFor="c-tags">برچسب‌ها</Label>
              <Input
                id="c-tags"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="با ویرگول جدا کنید"
              />
            </div>
          )}

          {/* SEO */}
          <div className="glass space-y-2 rounded-2xl border border-border/60 p-4">
            <h3 className="font-bold">سئو</h3>
            <div className="space-y-1.5">
              <Label htmlFor="c-seo-title">عنوان سئو</Label>
              <Input
                id="c-seo-title"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={title || "عنوان صفحه در نتایج جستجو"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-seo-desc">توضیحات متا</Label>
              <Textarea
                id="c-seo-desc"
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={3}
                placeholder="توضیح کوتاه برای موتورهای جستجو"
              />
            </div>
          </div>

          {/* Navigation */}
          {def.navigation.canAppearInNav && (
            <div className="glass space-y-3 rounded-2xl border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">نمایش در منو</h3>
                <Switch checked={navShow} onCheckedChange={setNavShow} aria-label="نمایش در منو" />
              </div>
              {navShow && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-nav-label">عنوان منو</Label>
                    <Input
                      id="c-nav-label"
                      value={navLabel}
                      onChange={(e) => setNavLabel(e.target.value)}
                      placeholder={title || "برچسب منو"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-nav-order">ترتیب</Label>
                    <Input
                      id="c-nav-order"
                      type="number"
                      value={navOrder}
                      onChange={(e) => setNavOrder(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>محل نمایش</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {PLACEMENTS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => togglePlacement(p.value)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                            navPlacement.includes(p.value)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-secondary",
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <MediaManager
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        accept="IMAGE"
        onSelect={(asset: MediaAssetDTO) => {
          setCoverImageUrl(asset.url)
          setMediaOpen(false)
        }}
      />
    </div>
  )
}

function statusLabel(s: string) {
  return (
    { DRAFT: "پیش‌نویس", SCHEDULED: "زمان‌بندی‌شده", PUBLISHED: "منتشرشده", ARCHIVED: "بایگانی" }[
      s
    ] ?? s
  )
}
