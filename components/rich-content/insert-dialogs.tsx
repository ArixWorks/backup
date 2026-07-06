"use client"

import { useEffect, useState } from "react"
import type { Editor } from "@tiptap/react"
import { Loader2, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { parseEmbed } from "./embed"
import { searchLinks, type LinkHit } from "./client-api"
import { REF_LABELS, type RefType } from "@/lib/rich-content/refs"

/* ---------------- Link dialog (URL + internal search) ---------------- */
export function LinkDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [tab, setTab] = useState<"url" | "internal">("url")
  const [url, setUrl] = useState("")
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<LinkHit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setUrl(editor.getAttributes("link").href ?? "")
      setQ("")
      setHits([])
      setTab("url")
    }
  }, [open, editor])

  useEffect(() => {
    if (tab !== "internal" || q.trim().length < 1) return
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        setHits(await searchLinks(q.trim()))
      } catch (err) {
        console.log("[v0] link search failed:", err)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, tab])

  const applyUrl = () => {
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
    }
    onOpenChange(false)
  }

  const applyInternal = (hit: LinkHit) => {
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: "#", "data-ref-type": hit.type, "data-ref-id": hit.id } as never)
      .run()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>درج پیوند</DialogTitle>
          <DialogDescription>پیوند بیرونی یا لینک هوشمند داخلی</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant={tab === "url" ? "default" : "secondary"} onClick={() => setTab("url")}>
            آدرس اینترنتی
          </Button>
          <Button type="button" size="sm" variant={tab === "internal" ? "default" : "secondary"} onClick={() => setTab("internal")}>
            لینک داخلی هوشمند
          </Button>
        </div>

        {tab === "url" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rc-link-url">آدرس</Label>
              <Input
                id="rc-link-url"
                dir="ltr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && applyUrl()}
              />
            </div>
            <DialogFooter>
              <Button onClick={applyUrl}>اعمال</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute inset-inline-start-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی محصول، مزایده، قرعه‌کشی…" className="ps-8" />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : hits.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">موردی یافت نشد</p>
              ) : (
                hits.map((hit) => (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    type="button"
                    onClick={() => applyInternal(hit)}
                    className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-start text-sm transition-colors hover:border-primary hover:bg-accent"
                  >
                    <span className="truncate">{hit.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {REF_LABELS[hit.type as RefType] ?? hit.sub ?? hit.type}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Embed dialog ---------------- */
export function EmbedDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setUrl("")
      setError("")
    }
  }, [open])

  const insert = () => {
    const parsed = parseEmbed(url)
    if (!parsed) {
      setError("آدرس معتبر نیست")
      return
    }
    editor.chain().focus().insertContent({ type: "videoEmbed", attrs: parsed }).run()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>درج ویدیو</DialogTitle>
          <DialogDescription>آدرس یوتیوب، آپارات، ویمئو یا تلگرام را وارد کنید</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={insert}>درج</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Callout dialog ---------------- */
const CALLOUT_KINDS = [
  { value: "info", label: "اطلاعات" },
  { value: "success", label: "موفقیت" },
  { value: "warning", label: "هشدار" },
  { value: "danger", label: "خطر" },
  { value: "tip", label: "نکته" },
]

export function CalloutDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [kind, setKind] = useState("info")

  const insert = () => {
    editor
      .chain()
      .focus()
      .insertContent({
        type: "callout",
        attrs: { kind },
        content: [{ type: "paragraph" }],
      })
      .run()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>درج کالاوت</DialogTitle>
          <DialogDescription>نوع جعبه را انتخاب کنید</DialogDescription>
        </DialogHeader>
        <Select value={kind} onValueChange={(v) => v && setKind(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CALLOUT_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button onClick={insert}>درج</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Variable dialog ---------------- */
const VARIABLES = [
  { key: "user.name", label: "نام کاربر" },
  { key: "user.balance", label: "موجودی کیف پول" },
  { key: "order.id", label: "شناسه سفارش" },
  { key: "product.title", label: "عنوان محصول" },
  { key: "product.price", label: "قیمت محصول" },
  { key: "site.name", label: "نام سایت" },
  { key: "date.today", label: "تاریخ امروز" },
]

export function VariableDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [varKey, setVarKey] = useState(VARIABLES[0].key)
  const [fallback, setFallback] = useState("")

  const insert = () => {
    editor.chain().focus().insertContent({ type: "variable", attrs: { varKey, fallback } }).run()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>درج متغیر</DialogTitle>
          <DialogDescription>مقدار پویا هنگام نمایش جایگزین می‌شود</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={varKey} onValueChange={(v) => v && setVarKey(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VARIABLES.map((v) => (
                <SelectItem key={v.key} value={v.key}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1.5">
            <Label htmlFor="rc-var-fallback">مقدار پیش‌فرض (اختیاری)</Label>
            <Input id="rc-var-fallback" value={fallback} onChange={(e) => setFallback(e.target.value)} placeholder="—" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={insert}>درج</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Attachment dialog ---------------- */
export function AttachmentDialog({
  editor,
  open,
  onOpenChange,
  onOpenMedia,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (v: boolean) => void
  onOpenMedia: () => void
}) {
  const [href, setHref] = useState("")
  const [filename, setFilename] = useState("")

  useEffect(() => {
    if (open) {
      setHref("")
      setFilename("")
    }
  }, [open])

  const insert = () => {
    if (!href.trim()) return
    editor
      .chain()
      .focus()
      .insertContent({ type: "attachment", attrs: { href: href.trim(), filename: filename.trim() || "فایل" } })
      .run()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>درج پیوست</DialogTitle>
          <DialogDescription>یک فایل از کتابخانه انتخاب کنید یا آدرس آن را وارد کنید</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button type="button" variant="secondary" className="w-full" onClick={onOpenMedia}>
            انتخاب از کتابخانه رسانه
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="rc-att-href">آدرس فایل</Label>
            <Input id="rc-att-href" dir="ltr" value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rc-att-name">نام نمایشی</Label>
            <Input id="rc-att-name" value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="راهنما.pdf" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={insert}>درج</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- Emoji dialog ---------------- */
const EMOJI_GROUPS: { label: string; items: string[] }[] = [
  { label: "پرکاربرد", items: ["😀", "😍", "🎉", "🔥", "👍", "🙏", "❤️", "✅", "⭐", "💎", "🚀", "🎁"] },
  { label: "چهره‌ها", items: ["😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😎", "🤩", "🤔", "😴", "😅", "😭", "😡", "🥳"] },
  { label: "دست‌ها", items: ["👍", "👎", "👌", "✌️", "🤞", "🙏", "👏", "🙌", "💪", "🫶", "🤝", "✍️"] },
  { label: "اشیا و نمادها", items: ["🔥", "⭐", "✨", "🎉", "🎊", "🎁", "💎", "💰", "🏆", "🥇", "✅", "❌", "⚠️", "❤️", "💙", "💚", "📌", "🔔"] },
  { label: "تجارت", items: ["🛒", "🛍️", "💳", "🏷️", "📦", "🚚", "📈", "📉", "💹", "🧾", "🏦", "💵"] },
]

export function EmojiDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [q, setQ] = useState("")

  useEffect(() => {
    if (open) setQ("")
  }, [open])

  const insert = (emoji: string) => {
    editor.chain().focus().insertContent(emoji).run()
    onOpenChange(false)
  }

  const groups = q.trim()
    ? [{ label: "نتایج", items: EMOJI_GROUPS.flatMap((g) => g.items).filter((_, i, arr) => arr.indexOf(arr[i]) === i) }]
    : EMOJI_GROUPS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>درج اموجی</DialogTitle>
          <DialogDescription>یک اموجی برای درج انتخاب کنید</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute inset-inline-start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو…" className="ps-8" />
        </div>
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{g.label}</div>
              <div className="grid grid-cols-8 gap-1">
                {g.items.map((emoji, i) => (
                  <button
                    key={`${g.label}-${i}`}
                    type="button"
                    onClick={() => insert(emoji)}
                    className="flex size-8 items-center justify-center rounded-md text-lg transition-colors hover:bg-accent"
                    aria-label={`درج ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- AI generate dialog ---------------- */
export function AiDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setPrompt("")
  }, [open])

  const generate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    try {
      const { apiPost } = await import("@/lib/api-client")
      const res = await apiPost<{ html: string }>("/api/v1/admin/ai/content", {
        task: "inline",
        action: "expand",
        html: `<p>${prompt.trim()}</p>`,
      })
      editor.chain().focus().insertContent(res.html).run()
      onOpenChange(false)
    } catch (err) {
      console.log("[v0] ai generate failed:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>دستیار هوش مصنوعی</DialogTitle>
          <DialogDescription>موضوع یا دستور خود را بنویسید تا متن تولید شود</DialogDescription>
        </DialogHeader>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="مثلاً: یک پاراگراف معرفی برای اشتراک پریمیوم بنویس" />
        <DialogFooter>
          <Button onClick={generate} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            تولید
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
