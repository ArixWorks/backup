"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Megaphone, Send, ImageIcon, Loader2, ExternalLink, Eye } from "lucide-react"
import { fetcher, apiPost, ApiError } from "@/lib/api-client"
import { buildCaption } from "@/lib/channel-format"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  CopilotProvider,
  CopilotLauncher,
  useCopilotAdapter,
  type FieldBinding,
} from "@/components/admin/ai/copilot"

type ProductRow = {
  id: string
  title: string
  coverImage: string | null
  saleMode: "FIXED_PRICE" | "AUCTION"
  fixedSale: { price: string | number } | null
}

const FREEFORM = "__freeform__"

export function ChannelComposer() {
  const { data: productsRes } = useSWR<{ data: ProductRow[] }>(
    "/api/v1/admin/products",
    fetcher,
  )
  const products = productsRes?.data ?? []

  const [productId, setProductId] = useState<string>(FREEFORM)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [buttonLabel, setButtonLabel] = useState("🛒 خرید")
  const [sending, setSending] = useState(false)

  const selectedProduct = products.find((p) => p.id === productId)
  const hasButton = productId !== FREEFORM && buttonLabel.trim().length > 0

  const caption = useMemo(() => buildCaption({ title, body }), [title, body])

  const bindings: Record<string, FieldBinding> = {
    title: { get: () => title, set: (v) => setTitle(String(v ?? "")), localized: true },
    body: { get: () => body, set: (v) => setBody(String(v ?? "")), localized: true },
    image: { get: () => imageUrl, set: (v) => setImageUrl(String(v ?? "")) },
  }
  const { adapter } = useCopilotAdapter(bindings)

  function applyProduct(value: string | null) {
    const id = value ?? FREEFORM
    setProductId(id)
    if (id === FREEFORM) return
    const p = products.find((x) => x.id === id)
    if (!p) return
    // Prefill the composer from the product as a friendly starting point.
    setTitle(`⭐️ ${p.title}`)
    setBody(
      "🔥 تخفیف ویژه فعال شد!\nهمین حالا قبل از اتمام موجودی سفارش بده.",
    )
    if (p.coverImage) setImageUrl(p.coverImage)
  }

  async function send() {
    if (!caption.trim()) {
      toast.error("متن پست را وارد کنید.")
      return
    }
    setSending(true)
    try {
      const res = await apiPost<{ data: { messageId: number } }>("/api/v1/admin/channel", {
        productId: productId === FREEFORM ? undefined : productId,
        caption,
        imageUrl: imageUrl.trim() || undefined,
        buttonLabel: hasButton ? buttonLabel.trim() : undefined,
      })
      toast.success(`پست با موفقیت ارسال شد (#${res.data.messageId})`)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "ارسال ناموفق بود"
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <CopilotProvider entityId="channel-post" mode="create" adapter={adapter}>
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <Megaphone className="h-6 w-6 text-primary" />
            پست کانال
          </h1>
          <p className="text-sm text-muted-foreground">
            متن و عکس پست تبلیغاتی را بساز، پیش‌نمایش را ببین و مستقیم به کانال ارسال کن. اگر محصولی
            انتخاب کنی، دکمه‌ی خرید با لینک عمیق به ربات اضافه می‌شود.
          </p>
        </div>
        <CopilotLauncher />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <Card className="space-y-4 p-5">
          <div className="space-y-2">
            <Label>محصول (اختیاری)</Label>
            <Select value={productId} onValueChange={applyProduct}>
              <SelectTrigger>
                <SelectValue placeholder="بدون محصول (پیام آزاد)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FREEFORM}>بدون محصول (پیام آزاد)</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-title">عنوان</Label>
            <Input
              id="ch-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="⭐️ Gemini Pro — 18 Months"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-body">متن</Label>
            <Textarea
              id="ch-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"🔥 قیمت کاهش یافت!\nهمین حالا سفارش بده."}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-image" className="flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4" />
              آدرس عکس (اختیاری)
            </Label>
            <Input
              id="ch-image"
              dir="ltr"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…/cover.png"
            />
          </div>

          {productId !== FREEFORM && (
            <div className="space-y-2">
              <Label htmlFor="ch-btn">متن دکمه خرید</Label>
              <Input
                id="ch-btn"
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                placeholder="🛒 خرید"
              />
            </div>
          )}

          <Button onClick={send} disabled={sending} className="w-full gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            ارسال به کانال
          </Button>
        </Card>

        {/* Live preview */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Eye className="h-4 w-4" />
            پیش‌نمایش
          </div>
          <div className="rounded-2xl bg-[#17212b] p-4">
            <div className="max-w-sm overflow-hidden rounded-xl bg-[#212d3b] text-[#e9eef5] shadow-lg">
              {imageUrl.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl.trim() || "/placeholder.svg"}
                  alt="پیش‌نمایش عکس پست"
                  className="aspect-video w-full object-cover"
                />
              ) : null}
              <div className="space-y-2 p-3">
                {title.trim() && (
                  <p className="text-sm font-bold leading-relaxed">{title}</p>
                )}
                {body.trim() && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#c9d4e0]">
                    {body}
                  </p>
                )}
                {!title.trim() && !body.trim() && (
                  <p className="text-sm text-[#7c8da0]">متن پست اینجا نمایش داده می‌شود…</p>
                )}
              </div>
              {hasButton && (
                <div className="border-t border-white/10 p-2">
                  <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2b5278] py-2 text-sm font-medium text-white">
                    {buttonLabel}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </div>
                </div>
              )}
            </div>
          </div>
          {selectedProduct && (
            <p className="text-xs text-muted-foreground">
              دکمه به لینک عمیق خرید این محصول در ربات وصل می‌شود.
            </p>
          )}
        </div>
      </div>
    </div>
    </CopilotProvider>
  )
}
