"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { apiPost } from "@/lib/api-client"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { LinksEditor } from "@/components/admin/links-editor"
import { ImageUpload } from "@/components/admin/image-upload"
import { PriceResearchDialog } from "@/components/admin/price-research-dialog"
import { RichContentEditor, EnhancedTextarea } from "@/components/rich-content"
import { tehranInputToUtcISO } from "@/lib/format"
import {
  CopilotProvider,
  CopilotLauncher,
  useCopilotAdapter,
  type FieldBinding,
} from "@/components/admin/ai/copilot"

type DeliveryType = "MANUAL" | "AUTOMATIC"

function Field({
  label,
  children,
  hint,
  action,
}: {
  label: string
  children: React.ReactNode
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {action}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export default function NewProductPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"flash" | "auction">("flash")
  const [saving, setSaving] = useState(false)

  // shared
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [shortDescription, setShortDescription] = useState("")
  const [category, setCategory] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [coverImage, setCoverImage] = useState("")
  const [gallery, setGallery] = useState<string[]>([])
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("MANUAL")

  // flash
  const [price, setPrice] = useState("")
  const [compareAtPrice, setCompareAtPrice] = useState("")
  const [stock, setStock] = useState("")
  const [purchaseLimit, setPurchaseLimit] = useState("")
  const [soldBaseline, setSoldBaseline] = useState("")
  const [bulkMinQty, setBulkMinQty] = useState("")
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState("")
  const [links, setLinks] = useState<{ label: string; url: string }[]>([])

  // auction
  const [startPrice, setStartPrice] = useState("")
  const [minIncrement, setMinIncrement] = useState("")
  const [reservePrice, setReservePrice] = useState("")
  const [buyNowPrice, setBuyNowPrice] = useState("")
  const [estimatedValue, setEstimatedValue] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")

  // Copilot bindings — map entity field keys to this form's state.
  const bindings: Record<string, FieldBinding> = {
    title: { get: () => title, set: (v) => setTitle(String(v ?? "")), localized: true },
    shortDescription: { get: () => shortDescription, set: (v) => setShortDescription(String(v ?? "")), localized: true },
    description: { get: () => description, set: (v) => setDescription(String(v ?? "")), localized: true },
    category: { get: () => category, set: (v) => setCategory(String(v ?? "")) },
    tags: { get: () => tags, set: (v) => setTags(Array.isArray(v) ? v.map(String) : []) },
    deliveryType: { get: () => deliveryType, set: (v) => setDeliveryType((v as DeliveryType) || "MANUAL") },
    price: { get: () => price, set: (v) => setPrice(String(v ?? "")) },
    stock: { get: () => stock, set: (v) => setStock(String(v ?? "")) },
    startPrice: { get: () => startPrice, set: (v) => setStartPrice(String(v ?? "")) },
    minimumIncrement: { get: () => minIncrement, set: (v) => setMinIncrement(String(v ?? "")) },
    buyNowPrice: { get: () => buyNowPrice, set: (v) => setBuyNowPrice(String(v ?? "")) },
    coverImage: { get: () => coverImage, set: (v) => setCoverImage(String(v ?? "")) },
    gallery: {
      get: () => gallery,
      set: (v) =>
        setGallery((prev) =>
          Array.isArray(v) ? [...prev, ...v.map(String)] : v ? [...prev, String(v)] : prev,
        ),
    },
    seo: { get: () => "", set: () => {}, localized: true },
  }
  const { adapter, getI18n, hasTranslations } = useCopilotAdapter(bindings)

  async function submit() {
    if (!title.trim()) {
      toast.error("عنوان الزامی است")
      return
    }
    if (mode === "flash") {
      if (!price || Number(price) <= 0) {
        toast.error("قیمت معتبر وارد کنید")
        return
      }
    } else {
      if (!startPrice || Number(startPrice) <= 0) {
        toast.error("قیمت پایه معتبر وارد کنید")
        return
      }
      if (!minIncrement || Number(minIncrement) <= 0) {
        toast.error("حداقل افزایش پیشنهاد را وارد کنید")
        return
      }
      if (!startTime || !endTime) {
        toast.error("زمان شروع و پایان را تعیین کنید")
        return
      }
      if (new Date(endTime) <= new Date(startTime)) {
        toast.error("زمان پایان باید بعد از زمان شروع باشد")
        return
      }
    }
    setSaving(true)
    try {
      const base = {
        mode: mode === "flash" ? ("FIXED_PRICE" as const) : ("AUCTION" as const),
        title: title.trim(),
        description: description || undefined,
        category: category || undefined,
        tags: tags.length ? tags : undefined,
        gallery: gallery.length ? gallery : undefined,
        i18n: hasTranslations() ? getI18n() : undefined,
        coverImage: coverImage || undefined,
        deliveryType,
      }
      const payload =
        mode === "flash"
          ? {
              ...base,
              price: Number(price),
              compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
              stock: Number(stock || 0),
              purchaseLimit: purchaseLimit ? Number(purchaseLimit) : null,
              soldBaseline: soldBaseline ? Number(soldBaseline) : undefined,
              bulkMinQty: bulkMinQty ? Number(bulkMinQty) : null,
              bulkDiscountPercent: bulkDiscountPercent ? Number(bulkDiscountPercent) : null,
              links: links.filter((l) => l.label.trim() && l.url.trim()),
            }
          : {
              ...base,
              startPrice: Number(startPrice),
              minimumIncrement: Number(minIncrement),
              reservePrice: reservePrice ? Number(reservePrice) : null,
              buyNowPrice: buyNowPrice ? Number(buyNowPrice) : null,
              estimatedValue: estimatedValue ? Number(estimatedValue) : null,
              quantity: Number(quantity || 1),
              startTime: tehranInputToUtcISO(startTime),
              endTime: tehranInputToUtcISO(endTime),
            }
      const res = await apiPost<{ data: { id: string } }>("/api/v1/admin/products", payload)
      toast.success("محصول ساخته شد")
      router.push(`/admin/products/${res.data.id}`)
    } catch (e: any) {
      toast.error(e.message ?? "خطا در ساخت محصول")
    } finally {
      setSaving(false)
    }
  }

  return (
    <CopilotProvider entityId="product" mode="create" adapter={adapter}>
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/products"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">محصول جدید</h1>
          <p className="text-sm text-muted-foreground">
            نوع فروش، اطلاعات پایه و قیمت‌گذاری را تعیین کنید
          </p>
        </div>
        <CopilotLauncher />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="space-y-5 p-6">
          <Field label="عنوان محصول">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً اشتراک یک‌ساله ChatGPT Plus" />
          </Field>
          <Field label="توضیح کوتاه" hint="یک جمله جذاب برای کارت محصول">
            <EnhancedTextarea
              value={shortDescription}
              onChange={setShortDescription}
              minRows={2}
              maxRows={5}
              maxLength={200}
              placeholder="مثلاً: دسترسی فوری، گارانتی بازگشت وجه"
            />
          </Field>
          <Field label="توضیحات کامل" hint="ویرایشگر کامل با پشتیبانی از رسانه، جدول، هشدار و دستیار هوشمند">
            <RichContentEditor
              value={description}
              onChange={setDescription}
              draftKey="product-new-description"
              placeholder="توضیح کامل درباره محصول را بنویسید یا «/» را برای دستورها تایپ کنید…"
            />
          </Field>
          <Field label="دسته‌بندی">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="هوش مصنوعی" />
          </Field>
          <Field label="برچسب‌ها" hint="با کاما جدا کنید">
            <Input
              value={tags.join("، ")}
              onChange={(e) =>
                setTags(
                  e.target.value
                    .split(/[,،]/)
                    .map((t) => t.trim())
                    .filter(Boolean),
                )
              }
              placeholder="پرمیوم، اشتراک، هوش مصنوعی"
            />
          </Field>
          <Field label="تصویر کاور" hint="پس از انتخاب، تصویر را در نسبت ۱۶:۹ برش بزنید">
            <ImageUpload value={coverImage} onChange={setCoverImage} folder="products" aspect="aspect-video" />
          </Field>
          {gallery.length > 0 ? (
            <Field label="گالری" hint="تصاویر ساخته‌شده توسط دستیار">
              <div className="flex flex-wrap gap-2">
                {gallery.map((url, i) => (
                  <div key={`${url}-${i}`} className="relative">
                    { }
                    <img
                      src={url || "/placeholder.svg"}
                      alt={`گالری ${i + 1}`}
                      className="size-16 rounded-md border border-border object-cover"
                      crossOrigin="anonymous"
                    />
                    <button
                      type="button"
                      onClick={() => setGallery((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground"
                      aria-label="حذف تصویر"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </Field>
          ) : null}
          <Field label="نوع تحویل" hint="تحویل خودکار از مخزن موجودی انجام می‌شود">
            <Select value={deliveryType} onValueChange={(v) => setDeliveryType(v as DeliveryType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">دستی (توسط پشتیبان)</SelectItem>
                <SelectItem value="AUTOMATIC">خودکار (از مخزن موجودی)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Card>

        <Card className="space-y-5 p-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "flash" | "auction")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="flash">فروشگاه</TabsTrigger>
              <TabsTrigger value="auction">مزایده</TabsTrigger>
            </TabsList>

            <TabsContent value="flash" className="mt-4 space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">چند قیمت برای یک محصول؟</span>{" "}
                این قیمت، قیمت پایه است. پس از «ساخت محصول»، در صفحه ویرایش بخش «پلن‌های فروش» را باز کنید تا
                پلن‌های مختلف (مثلاً ۱ ماهه، ۳ ماهه، ۱ ساله) هرکدام با قیمت و موجودی مستقل اضافه کنید.
              </div>
              <Field label="قیمت فروش پایه (تومان)">
                <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" dir="ltr" placeholder="750000" />
              </Field>
              <Field
                label="قیمت اصلی (خط‌خورده)"
                hint="اختیاری؛ اگر بیشتر از قیمت فروش باشد، خط‌خورده و درصد تخفیف نمایش داده می‌شود"
                action={
                  <PriceResearchDialog
                    title={title}
                    currentPrice={compareAtPrice ? Number(compareAtPrice) : null}
                    onApply={(p) => setCompareAtPrice(String(p))}
                  />
                }
              >
                <Input value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} inputMode="numeric" dir="ltr" placeholder="2000000" />
              </Field>
              <Field label="موجودی انبار">
                <Input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" dir="ltr" placeholder="20" />
              </Field>
              <Field label="محدودیت خرید هر کاربر" hint="خالی = بدون محدودیت">
                <Input value={purchaseLimit} onChange={(e) => setPurchaseLimit(e.target.value)} inputMode="numeric" dir="ltr" placeholder="1" />
              </Field>
              <Field label="تعداد فروش نمایشی (پایه)" hint="به فروش واقعی اضافه می‌شود؛ مثل Sold: 2218">
                <Input value={soldBaseline} onChange={(e) => setSoldBaseline(e.target.value)} inputMode="numeric" dir="ltr" placeholder="0" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="حداقل تعداد تخفیف عمده" hint="مثلاً ۱۰">
                  <Input value={bulkMinQty} onChange={(e) => setBulkMinQty(e.target.value)} inputMode="numeric" dir="ltr" placeholder="10" />
                </Field>
                <Field label="درصد تخفیف عمده" hint="مثلاً ۷">
                  <Input value={bulkDiscountPercent} onChange={(e) => setBulkDiscountPercent(e.target.value)} inputMode="numeric" dir="ltr" placeholder="7" />
                </Field>
              </div>
              <LinksEditor links={links} onChange={setLinks} />
            </TabsContent>

            <TabsContent value="auction" className="mt-4 space-y-4">
              <Field label="قیمت پایه (تومان)">
                <Input value={startPrice} onChange={(e) => setStartPrice(e.target.value)} inputMode="numeric" dir="ltr" placeholder="500000" />
              </Field>
              <Field label="حداقل افزایش پیشنهاد">
                <Input value={minIncrement} onChange={(e) => setMinIncrement(e.target.value)} inputMode="numeric" dir="ltr" placeholder="50000" />
              </Field>
              <Field label="ارزش حقیقی محصول (تومان)" hint="اختیاری؛ فقط نمایشی — ارزش واقعی کالا به‌عنوان مرجع به شرکت‌کننده‌ها نشان داده می‌شود و روی قیمت‌گذاری اثری ندارد">
                <Input value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} inputMode="numeric" dir="ltr" placeholder="500000" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="قیمت رزرو" hint="اختیاری">
                  <Input value={reservePrice} onChange={(e) => setReservePrice(e.target.value)} inputMode="numeric" dir="ltr" placeholder="—" />
                </Field>
                <Field label="خرید فوری" hint="اختیاری">
                  <Input value={buyNowPrice} onChange={(e) => setBuyNowPrice(e.target.value)} inputMode="numeric" dir="ltr" placeholder="—" />
                </Field>
              </div>
              <Field label="تعداد برنده">
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" dir="ltr" placeholder="1" />
              </Field>
              <Field label="زمان شروع">
                <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} dir="ltr" />
              </Field>
              <Field label="زمان پایان">
                <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} dir="ltr" />
              </Field>
            </TabsContent>
          </Tabs>

          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? "در حال ذخیره…" : "ساخت محصول"}
          </Button>
        </Card>
      </div>
    </div>
    </CopilotProvider>
  )
}
