"use client"

import { useState } from "react"
import { Eye, Loader2, Send, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { apiPost, ApiError } from "@/lib/api-client"
import {
  CopilotProvider,
  CopilotLauncher,
  useCopilotAdapter,
  type FieldBinding,
} from "@/components/admin/ai/copilot"

type Locale = "fa" | "en"

export function EmailComposer() {
  const [subject, setSubject] = useState("")
  const [heading, setHeading] = useState("")
  const [body, setBody] = useState("")
  const [actionUrl, setActionUrl] = useState("")
  const [actionLabel, setActionLabel] = useState("")
  const [locale, setLocale] = useState<Locale>("fa")
  const [testTo, setTestTo] = useState("")

  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)

  // AI Copilot binds the subject + body fields (both localized).
  const bindings: Record<string, FieldBinding> = {
    subject: { get: () => subject, set: (v) => setSubject(String(v ?? "")), localized: true },
    body: { get: () => body, set: (v) => setBody(String(v ?? "")), localized: true },
  }
  const { adapter } = useCopilotAdapter(bindings)

  function payload(extra?: Record<string, unknown>) {
    return {
      subject: subject.trim(),
      heading: heading.trim() || undefined,
      body: body.trim(),
      actionUrl: actionUrl.trim() || undefined,
      actionLabel: actionLabel.trim() || undefined,
      locale,
      ...extra,
    }
  }

  async function preview() {
    if (!subject.trim() || !body.trim()) {
      toast.error("موضوع و متن ایمیل را کامل کنید")
      return
    }
    setPreviewing(true)
    try {
      const res = await apiPost<{ data: { subject: string; html: string } }>(
        "/api/v1/admin/email/compose",
        payload({ action: "preview" }),
      )
      setPreviewHtml(res.data.html)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "خطا در ساخت پیش‌نمایش")
    } finally {
      setPreviewing(false)
    }
  }

  async function sendTest() {
    if (!subject.trim() || !body.trim()) {
      toast.error("موضوع و متن ایمیل را کامل کنید")
      return
    }
    if (!testTo.trim()) {
      toast.error("ایمیل گیرنده آزمایشی را وارد کنید")
      return
    }
    setSending(true)
    try {
      await apiPost("/api/v1/admin/email/compose", payload({ action: "send", to: testTo.trim() }))
      toast.success(`ایمیل آزمایشی به ${testTo.trim()} ارسال شد`)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ارسال آزمایشی ناموفق بود")
    } finally {
      setSending(false)
    }
  }

  return (
    <CopilotProvider entityId="email" mode="create" adapter={adapter}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Sparkles className="h-4 w-4 text-primary" />
              نوشتن ایمیل
            </h2>
            <CopilotLauncher />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">زبان:</span>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {(["fa", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    setLocale(l)
                    setPreviewHtml(null)
                  }}
                  className={
                    "px-3 py-1.5 text-sm transition-colors " +
                    (locale === l
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-muted")
                  }
                >
                  {l === "fa" ? "فارسی" : "English"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-subject">موضوع ایمیل</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثلاً: پیشنهاد ویژه این هفته"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-heading">تیتر داخل ایمیل (اختیاری)</Label>
            <Input
              id="email-heading"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="اگر خالی بماند، موضوع استفاده می‌شود"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-body">متن ایمیل</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="متن اصلی ایمیل را اینجا بنویسید یا از دستیار هوش مصنوعی کمک بگیرید"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email-cta-url">لینک دکمه (اختیاری)</Label>
              <Input
                id="email-cta-url"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="https://..."
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-cta-label">متن دکمه</Label>
              <Input
                id="email-cta-label"
                value={actionLabel}
                onChange={(e) => setActionLabel(e.target.value)}
                placeholder="مشاهده"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="secondary" onClick={preview} disabled={previewing}>
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              پیش‌نمایش
            </Button>
          </div>
        </div>

        {/* Preview + test send */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <Eye className="h-4 w-4 text-primary" />
              پیش‌نمایش
            </h2>
            {previewHtml ? (
              <iframe
                title="پیش‌نمایش ایمیل"
                srcDoc={previewHtml}
                className="h-[420px] w-full rounded-lg border border-border bg-white"
              />
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                برای دیدن قالب واقعی ایمیل، دکمه «پیش‌نمایش» را بزنید
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 flex items-center gap-2 font-bold">
              <Send className="h-4 w-4 text-primary" />
              ارسال آزمایشی
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              ایمیل فقط به یک آدرس آزمایشی ارسال می‌شود. ارسال انبوه در فاز بعدی اضافه خواهد شد.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="test@example.com"
                dir="ltr"
                type="email"
              />
              <Button onClick={sendTest} disabled={sending} className="gap-1.5 shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                ارسال تست
              </Button>
            </div>
          </div>
        </div>
      </div>
    </CopilotProvider>
  )
}
