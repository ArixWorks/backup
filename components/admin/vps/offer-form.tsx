"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { apiPost, apiPatch } from "@/lib/api-client"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button, buttonVariants } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ImageUpload } from "@/components/admin/image-upload"
import { RichContentEditor } from "@/components/rich-content"

const STOCK_OPTIONS: { value: string; label: string }[] = [
  { value: "AVAILABLE", label: "موجود" },
  { value: "LIMITED", label: "محدود" },
  { value: "ON_REQUEST", label: "بنا به درخواست" },
  { value: "TEMPORARILY_UNAVAILABLE", label: "موقتاً ناموجود" },
  { value: "DISABLED", label: "غیرفعال" },
]

export type VpsOfferFormValue = {
  id?: string
  name: string
  slug: string
  location: string
  cpu: string
  ram: string
  storage: string
  storageType: string
  bandwidth: string
  ipv4: number
  ipv6: boolean
  portSpeed: string
  os: string[]
  durationDays: number
  priceIrt: string
  listPriceIrt: string
  description: string
  features: string[]
  coverImage: string
  gallery: string[]
  stockStatus: string
  estimatedDeliveryText: string
  active: boolean
  seoTitle: string
  seoDescription: string
  seoKeywords: string[]
  ogImageUrl: string
  providerCostToman: string
  providerLabel: string
  backupProviderLabel: string
}

export const EMPTY_OFFER: VpsOfferFormValue = {
  name: "",
  slug: "",
  location: "",
  cpu: "",
  ram: "",
  storage: "",
  storageType: "NVMe",
  bandwidth: "",
  ipv4: 1,
  ipv6: false,
  portSpeed: "",
  os: [],
  durationDays: 30,
  priceIrt: "",
  listPriceIrt: "",
  description: "",
  features: [],
  coverImage: "",
  gallery: [],
  stockStatus: "ON_REQUEST",
  estimatedDeliveryText: "",
  active: true,
  seoTitle: "",
  seoDescription: "",
  seoKeywords: [],
  ogImageUrl: "",
  providerCostToman: "",
  providerLabel: "",
  backupProviderLabel: "",
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Comma/newline separated list <-> string[] helper for simple list inputs. */
function CsvField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <Input
        value={value.join("، ")}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(/[،,\n]/)
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    </Field>
  )
}

export function VpsOfferForm({ initial }: { initial: VpsOfferFormValue }) {
  const router = useRouter()
  const isEdit = Boolean(initial.id)
  const [saving, setSaving] = useState(false)
  const [v, setV] = useState<VpsOfferFormValue>(initial)

  function set<K extends keyof VpsOfferFormValue>(key: K, value: VpsOfferFormValue[K]) {
    setV((prev) => ({ ...prev, [key]: value }))
  }

  const priceNumber = useMemo(() => Number(v.priceIrt.replace(/[^\d]/g, "")), [v.priceIrt])

  async function handleSave() {
    if (!v.name.trim()) return toast.error("نام پلن الزامی است")
    if (!v.location.trim()) return toast.error("موقعیت سرور الزامی است")
    if (!priceNumber || priceNumber <= 0) return toast.error("قیمت معتبر وارد کنید")

    const payload = {
      name: v.name.trim(),
      slug: v.slug.trim() || undefined,
      location: v.location.trim(),
      cpu: v.cpu.trim(),
      ram: v.ram.trim(),
      storage: v.storage.trim(),
      storageType: v.storageType.trim() || "NVMe",
      bandwidth: v.bandwidth.trim(),
      ipv4: Number(v.ipv4) || 0,
      ipv6: v.ipv6,
      portSpeed: v.portSpeed.trim() || null,
      os: v.os,
      durationDays: Number(v.durationDays) || 30,
      priceIrt: priceNumber,
      listPriceIrt: v.listPriceIrt ? Number(v.listPriceIrt.replace(/[^\d]/g, "")) : null,
      description: v.description,
      features: v.features,
      coverImage: v.coverImage || null,
      gallery: v.gallery,
      stockStatus: v.stockStatus,
      estimatedDeliveryText: v.estimatedDeliveryText.trim() || null,
      active: v.active,
      seoTitle: v.seoTitle.trim() || null,
      seoDescription: v.seoDescription.trim() || null,
      seoKeywords: v.seoKeywords,
      ogImageUrl: v.ogImageUrl || null,
      // providerCostCents stores the internal provider cost in whole Toman
      // (this platform is Toman-only; "Cents" is just the legacy column name).
      providerCostCents: v.providerCostToman ? Number(v.providerCostToman.replace(/[^\d]/g, "")) : null,
      providerCurrency: "IRT",
      providerLabel: v.providerLabel.trim() || null,
      backupProviderLabel: v.backupProviderLabel.trim() || null,
    }

    setSaving(true)
    try {
      if (isEdit) {
        await apiPatch(`/api/v1/admin/vps/offers/${initial.id}`, payload)
        toast.success("پلن به‌روزرسانی شد")
      } else {
        await apiPost("/api/v1/admin/vps/offers", payload)
        toast.success("پلن ایجاد شد")
      }
      router.push("/admin/vps/offers")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ذخیره‌سازی")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/vps/offers"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            aria-label="بازگشت"
          >
            <ArrowRight className="size-4" />
          </Link>
          <h1 className="text-lg font-semibold text-foreground">
            {isEdit ? "ویرایش پلن VPS" : "پلن جدید VPS"}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "در حال ذخیره…" : "ذخیره"}
        </Button>
      </div>

      <Tabs defaultValue="specs" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="specs">مشخصات</TabsTrigger>
          <TabsTrigger value="pricing">قیمت و موجودی</TabsTrigger>
          <TabsTrigger value="content">محتوا و رسانه</TabsTrigger>
          <TabsTrigger value="seo">سئو</TabsTrigger>
          <TabsTrigger value="internal">داخلی</TabsTrigger>
        </TabsList>

        {/* Specs */}
        <TabsContent value="specs" className="mt-4">
          <Card className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="نام پلن">
                <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="مثلاً VPS اقتصادی آلمان" />
              </Field>
              <Field label="نامک (slug)" hint="خالی بگذارید تا خودکار ساخته شود">
                <Input value={v.slug} onChange={(e) => set("slug", e.target.value)} placeholder="vps-eco-de" dir="ltr" />
              </Field>
              <Field label="موقعیت">
                <Input value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="آلمان - فرانکفورت" />
              </Field>
              <Field label="پردازنده (CPU)">
                <Input value={v.cpu} onChange={(e) => set("cpu", e.target.value)} placeholder="۲ هسته" />
              </Field>
              <Field label="حافظه (RAM)">
                <Input value={v.ram} onChange={(e) => set("ram", e.target.value)} placeholder="۴ گیگابایت" />
              </Field>
              <Field label="فضای ذخیره‌سازی">
                <Input value={v.storage} onChange={(e) => set("storage", e.target.value)} placeholder="۸۰ گیگابایت" />
              </Field>
              <Field label="نوع دیسک">
                <Input value={v.storageType} onChange={(e) => set("storageType", e.target.value)} placeholder="NVMe" dir="ltr" />
              </Field>
              <Field label="پهنای باند">
                <Input value={v.bandwidth} onChange={(e) => set("bandwidth", e.target.value)} placeholder="نامحدود" />
              </Field>
              <Field label="پورت شبکه">
                <Input value={v.portSpeed} onChange={(e) => set("portSpeed", e.target.value)} placeholder="۱ گیگابیت" />
              </Field>
              <Field label="تعداد IPv4">
                <Input
                  type="number"
                  min={0}
                  value={String(v.ipv4)}
                  onChange={(e) => set("ipv4", Number(e.target.value))}
                  dir="ltr"
                />
              </Field>
              <Field label="مدت دوره (روز)">
                <Input
                  type="number"
                  min={1}
                  value={String(v.durationDays)}
                  onChange={(e) => set("durationDays", Number(e.target.value))}
                  dir="ltr"
                />
              </Field>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label className="text-sm">IPv6 دارد</Label>
                <Switch checked={v.ipv6} onCheckedChange={(c) => set("ipv6", c)} />
              </div>
            </div>
            <CsvField
              label="سیستم‌عامل‌های قابل نصب"
              value={v.os}
              onChange={(next) => set("os", next)}
              placeholder="Ubuntu، Debian، Windows"
              hint="با ویرگول جدا کنید"
            />
          </Card>
        </TabsContent>

        {/* Pricing */}
        <TabsContent value="pricing" className="mt-4">
          <Card className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="قیمت فروش (تومان)">
                <Input value={v.priceIrt} onChange={(e) => set("priceIrt", e.target.value)} placeholder="۱۵۰۰۰۰" dir="ltr" inputMode="numeric" />
              </Field>
              <Field label="قیمت قبل از تخفیف (تومان)" hint="اختیاری - برای نمایش خط‌خورده">
                <Input value={v.listPriceIrt} onChange={(e) => set("listPriceIrt", e.target.value)} placeholder="۲۰۰۰۰۰" dir="ltr" inputMode="numeric" />
              </Field>
              <Field label="وضعیت موجودی">
                <Select value={v.stockStatus} onValueChange={(val) => set("stockStatus", val ?? "ON_REQUEST")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="زمان تحویل تخمینی" hint="مثلاً «۱ تا ۶ ساعت»">
                <Input value={v.estimatedDeliveryText} onChange={(e) => set("estimatedDeliveryText", e.target.value)} placeholder="۱ تا ۶ ساعت کاری" />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">نمایش در فروشگاه</Label>
                <p className="text-[11px] text-muted-foreground">پلن‌های غیرفعال برای کاربران دیده نمی‌شوند</p>
              </div>
              <Switch checked={v.active} onCheckedChange={(c) => set("active", c)} />
            </div>
          </Card>
        </TabsContent>

        {/* Content */}
        <TabsContent value="content" className="mt-4">
          <Card className="space-y-4 p-4">
            <Field label="توضیحات">
              <RichContentEditor value={v.description} onChange={(html) => set("description", html)} />
            </Field>
            <CsvField
              label="ویژگی‌های کلیدی"
              value={v.features}
              onChange={(next) => set("features", next)}
              placeholder="بکاپ خودکار، پشتیبانی ۲۴ساعته"
              hint="با ویرگول جدا کنید - در کارت پلن نمایش داده می‌شوند"
            />
            <Field label="تصویر کاور">
              <ImageUpload value={v.coverImage} onChange={(url) => set("coverImage", url)} />
            </Field>
          </Card>
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo" className="mt-4">
          <Card className="space-y-4 p-4">
            <Field label="عنوان سئو">
              <Input value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} />
            </Field>
            <Field label="توضیحات سئو">
              <Input value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
            </Field>
            <CsvField
              label="کلمات کلیدی"
              value={v.seoKeywords}
              onChange={(next) => set("seoKeywords", next)}
              placeholder="خرید vps، سرور مجازی آلمان"
            />
            <Field label="تصویر OG">
              <ImageUpload value={v.ogImageUrl} onChange={(url) => set("ogImageUrl", url)} />
            </Field>
          </Card>
        </TabsContent>

        {/* Internal */}
        <TabsContent value="internal" className="mt-4">
          <Card className="space-y-4 p-4">
            <p className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
              این اطلاعات فقط برای مدیران است و هرگز به کاربران نمایش داده نمی‌شود.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="هزینه تأمین (تومان)" hint="برای گزارش سود">
                <Input value={v.providerCostToman} onChange={(e) => set("providerCostToman", e.target.value)} dir="ltr" inputMode="numeric" />
              </Field>
              <Field label="تأمین‌کننده اصلی">
                <Input value={v.providerLabel} onChange={(e) => set("providerLabel", e.target.value)} placeholder="Hetzner" dir="ltr" />
              </Field>
              <Field label="تأمین‌کننده پشتیبان">
                <Input value={v.backupProviderLabel} onChange={(e) => set("backupProviderLabel", e.target.value)} placeholder="Contabo" dir="ltr" />
              </Field>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
