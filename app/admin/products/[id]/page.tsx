"use client"

import { use, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { ArrowRight, Boxes, Plus, Trash2, Loader2, Save } from "lucide-react"
import Link from "next/link"
import { fetcher, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { RichContent, RichContentEditor } from "@/components/rich-content"
import { DeliveryBadge } from "@/components/delivery-badge"
import { StatusPill } from "@/components/admin/status-pill"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { LinksEditor } from "@/components/admin/links-editor"
import { ImageUpload } from "@/components/admin/image-upload"
import { ImprovePanel, type I18nStore } from "@/components/admin/ai/copilot"
import { VariantsEditor } from "@/components/admin/products/variants-editor"

type ProductLink = { label: string; url: string }

type FixedSale = {
  price: number
  stock: number
  purchaseLimit: number | null
  soldCount?: number
  soldBaseline?: number
  bulkMinQty?: number | null
  bulkDiscountPercent?: number | null
}

type Product = {
  id: string
  title: string
  description: string | null
  category: string | null
  tags: string[]
  i18n: I18nStore | null
  saleMode: string
  deliveryType: string
  hidden: boolean
  active: boolean
  coverImage: string | null
  gallery: string[]
  links?: ProductLink[] | null
  fixedSale: FixedSale | null
}

type Inv = {
  id: string
  username: string | null
  password: string | null
  licenseKey: string | null
  note: string | null
  status: string
  createdAt: string
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, mutate } = useSWR<{ data: Product }>(`/api/v1/admin/products/${id}`, fetcher)
  const product = data?.data

  return (
    <div className="space-y-5">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به محصولات
      </Link>

      {!product ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold">{product.title}</h1>
              <DeliveryBadge type={product.deliveryType === "AUTOMATIC" ? "AUTO_POOL" : "MANUAL"} />
              {product.hidden && <StatusPill status="PENDING" className="!bg-muted" />}
            </div>
            {product.description && <RichContent content={product.description} className="mt-2" />}
          </div>

          <DescriptionEditor
            id={id}
            initial={product.description ?? ""}
            onSaved={mutate}
          />

          <ImprovePanel
            entityId="product"
            initial={{
              title: product.title,
              description: product.description ?? "",
              category: product.category ?? "",
              tags: product.tags ?? [],
              price: product.fixedSale ? String(product.fixedSale.price) : "",
            }}
            localizedKeys={["title", "description", "shortDescription", "seo"]}
            initialI18n={product.i18n ?? undefined}
            onSave={async (patch, i18n) => {
              const body: Record<string, unknown> = {}
              if (patch.title !== undefined) body.title = String(patch.title)
              if (patch.description !== undefined) body.description = String(patch.description)
              if (patch.category !== undefined) body.category = String(patch.category)
              if (patch.tags !== undefined) body.tags = patch.tags
              if (patch.price !== undefined) body.price = String(patch.price)
              if (Object.keys(i18n).length > 0) body.i18n = i18n
              const r = await fetch(`/api/v1/admin/products/${id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              })
              if (!r.ok) throw new ApiError((await r.json())?.error?.message ?? "خطا", "ERR", r.status)
              await mutate()
            }}
          />

          <MediaEditor
            id={id}
            coverImage={product.coverImage}
            gallery={product.gallery ?? []}
            onSaved={mutate}
          />

          {product.saleMode === "FIXED_PRICE" && product.fixedSale && (
            <>
              <div className="relative">
                <VariantsEditor productId={id} productTitle={product.title} />
              </div>
              <FlashEditor
                id={id}
                sale={product.fixedSale}
                initialLinks={product.links ?? []}
                onSaved={mutate}
              />
            </>
          )}

          {/* Product-level pool is only for auctions; fixed-price inventory
              lives per sale plan inside the plans editor above. */}
          {product.saleMode !== "FIXED_PRICE" &&
            (product.deliveryType === "AUTOMATIC" ? (
              <InventoryManager productId={id} />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                این محصول تحویل دستی دارد؛ نیازی به مخزن اکانت نیست.
              </div>
            ))}
        </>
      )}
    </div>
  )
}

function DescriptionEditor({
  id,
  initial,
  onSaved,
}: {
  id: string
  initial: string
  onSaved: () => void
}) {
  const [html, setHtml] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const r = await fetch(`/api/v1/admin/products/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: html }),
      })
      if (!r.ok) throw new ApiError((await r.json())?.error?.message ?? "خطا", "ERR", r.status)
      toast.success("توضیحات ذخیره شد")
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره توضیحات")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">توضیحات کامل</h2>
        <Button onClick={save} disabled={saving} size="sm" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره توضیحات
        </Button>
      </div>
      <RichContentEditor
        value={html}
        onChange={setHtml}
        draftKey={`product-${id}-description`}
        placeholder="توضیح کامل محصول را بنویسید یا «/» را برای دستورها تایپ کنید…"
      />
    </div>
  )
}

function MediaEditor({
  id,
  coverImage,
  gallery,
  onSaved,
}: {
  id: string
  coverImage: string | null
  gallery: string[]
  onSaved: () => void
}) {
  const [cover, setCover] = useState(coverImage ?? "")
  const [items, setItems] = useState<string[]>(gallery)
  const [saving, setSaving] = useState(false)

  async function patch(body: Record<string, unknown>) {
    setSaving(true)
    try {
      const r = await fetch(`/api/v1/admin/products/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new ApiError((await r.json())?.error?.message ?? "خطا", "ERR", r.status)
      toast.success("تصویر ذخیره شد")
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره تصویر")
    } finally {
      setSaving(false)
    }
  }

  function saveCover(url: string) {
    setCover(url)
    void patch({ coverImage: url })
  }

  function saveGallery(next: string[]) {
    setItems(next)
    void patch({ gallery: next })
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">تصاویر محصول</h2>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="space-y-1.5">
        <Label>تصویر کاور</Label>
        <p className="text-[11px] text-muted-foreground">با کلیک روی کادر، تصویر را انتخاب و در نسبت ۱۶:۹ برش بزنید.</p>
        <ImageUpload value={cover} onChange={saveCover} folder="products" aspect="aspect-video" />
      </div>

      <div className="space-y-1.5">
        <Label>گالری تصاویر</Label>
        <p className="text-[11px] text-muted-foreground">تصاویر بیشتری برای نمایش در صفحه محصول اضافه کنید (اختیاری).</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((url, i) => (
            <ImageUpload
              key={`${url}-${i}`}
              value={url}
              folder="products"
              aspect="aspect-video"
              onChange={(v) =>
                v
                  ? saveGallery(items.map((it, idx) => (idx === i ? v : it)))
                  : saveGallery(items.filter((_, idx) => idx !== i))
              }
            />
          ))}
          {items.length < 12 && (
            <ImageUpload
              key={`add-${items.length}`}
              value=""
              folder="products"
              aspect="aspect-video"
              onChange={(v) => v && saveGallery([...items, v])}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function FlashEditor({
  id,
  sale,
  initialLinks,
  onSaved,
}: {
  id: string
  sale: FixedSale
  initialLinks: ProductLink[]
  onSaved: () => void
}) {
  const [price, setPrice] = useState(String(sale.price))
  const [stock, setStock] = useState(String(sale.stock))
  const [soldBaseline, setSoldBaseline] = useState(String(sale.soldBaseline ?? 0))
  const [bulkMinQty, setBulkMinQty] = useState(sale.bulkMinQty ? String(sale.bulkMinQty) : "")
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState(
    sale.bulkDiscountPercent ? String(sale.bulkDiscountPercent) : "",
  )
  const [links, setLinks] = useState<ProductLink[]>(initialLinks)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/v1/admin/products/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          price,
          stock: Number(stock),
          soldBaseline: Number(soldBaseline || 0),
          bulkMinQty: bulkMinQty ? Number(bulkMinQty) : null,
          bulkDiscountPercent: bulkDiscountPercent ? Number(bulkDiscountPercent) : null,
          links: links.filter((l) => l.label.trim() && l.url.trim()),
        }),
      }).then(async (r) => {
        if (!r.ok) throw new ApiError((await r.json())?.error?.message ?? "خطا", "ERR", r.status)
      })
      toast.success("تغییرات ذخیره شد")
      onSaved()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-bold">قیمت پایه، تخفیف عمده و لینک‌ها</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          قیمت و موجودی واقعی از «پلن‌های فروش» بالا خوانده می‌شود. مقادیر زیر فقط زمانی استفاده می‌شوند که هیچ پلنی تعریف نشده باشد.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="price">قیمت (تومان)</Label>
          <Input
            id="price"
            value={price}
            inputMode="numeric"
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock">موجودی انبار</Label>
          <Input
            id="stock"
            value={stock}
            inputMode="numeric"
            onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="soldBaseline">فروش نمایشی (پایه)</Label>
          <Input
            id="soldBaseline"
            value={soldBaseline}
            inputMode="numeric"
            onChange={(e) => setSoldBaseline(e.target.value.replace(/[^0-9]/g, ""))}
            className="tabular-nums"
          />
          <p className="text-[11px] text-muted-foreground">
            فروش واقعی: {sale.soldCount ?? 0}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bulkMinQty">حداقل تعداد تخفیف عمده</Label>
          <Input
            id="bulkMinQty"
            value={bulkMinQty}
            inputMode="numeric"
            placeholder="مثلاً ۱۰"
            onChange={(e) => setBulkMinQty(e.target.value.replace(/[^0-9]/g, ""))}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bulkDiscountPercent">درصد تخفیف عمده</Label>
          <Input
            id="bulkDiscountPercent"
            value={bulkDiscountPercent}
            inputMode="numeric"
            placeholder="مثلاً ۷"
            onChange={(e) => setBulkDiscountPercent(e.target.value.replace(/[^0-9]/g, ""))}
            className="tabular-nums"
          />
        </div>
      </div>

      <LinksEditor links={links} onChange={setLinks} />

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره
        </Button>
      </div>
    </div>
  )
}

function InventoryManager({ productId }: { productId: string }) {
  const { data, isLoading, mutate } = useSWR<{ data: Inv[] }>(
    `/api/v1/admin/products/${productId}/inventory`,
    fetcher,
  )
  const items = data?.data ?? []
  const available = items.filter((i) => i.status === "AVAILABLE").length

  const [bulk, setBulk] = useState("")
  const [adding, setAdding] = useState(false)

  async function add() {
    const lines = bulk
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return toast.error("حداقل یک خط وارد کنید")
    // Each line: username:password  or  licenseKey
    const parsed = lines.map((line) => {
      if (line.includes(":")) {
        const [username, ...rest] = line.split(":")
        return { username: username.trim(), password: rest.join(":").trim() }
      }
      return { licenseKey: line }
    })
    setAdding(true)
    try {
      const res = await apiPost(`/api/v1/admin/products/${productId}/inventory`, { items: parsed })
      toast.success(`${res.data.added} آیتم اضافه شد`)
      setBulk("")
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
      toast.success("حذف شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف")
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          <Boxes className="h-4 w-4 text-primary" />
          مخزن تحویل خودکار
        </h2>
        <span className="text-xs text-muted-foreground">
          {available} آماده از {items.length} آیتم
        </span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bulk">افزودن گروهی (هر خط یک آیتم)</Label>
        <Textarea
          id="bulk"
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={4}
          dir="ltr"
          placeholder={"user1:pass1\nuser2:pass2\nLICENSE-KEY-XXXX"}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          قالب: «نام‌کاربری:رمز» برای اکانت، یا یک کلید لایسنس در هر خط.
        </p>
        <Button onClick={add} disabled={adding} className="gap-2">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          افزودن به مخزن
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)
        ) : items.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">مخزن خالی است.</div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0 font-mono text-xs" dir="ltr">
                {it.username ? `${it.username}:${it.password ?? ""}` : it.licenseKey || it.note}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill status={it.status === "AVAILABLE" ? "ACTIVE" : it.status} />
                {it.status === "AVAILABLE" && (
                  <button
                    onClick={() => remove(it.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
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
