"use client"

import { useState } from "react"
import { RichContentEditor } from "@/components/rich-content/rich-content-editor"
import { RichContent } from "@/components/rich-content/rich-content"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const SAMPLE = `<h2>به ویرایشگر محتوای یکپارچه خوش آمدید</h2>
<p>این یک متن نمونه است. می‌توانید با تایپ <code>/</code> منوی دستورات را باز کنید.</p>
<div data-callout="info"><p>این یک باکس اطلاع‌رسانی است.</p></div>
<ul><li>لیست نمونه</li><li>مورد دوم</li></ul>
<p>متغیر پویا: <span data-var="site.name">SubIO</span></p>`

// A minimal live context for demoing dynamic-variable resolution.
const DEMO_CONTEXT = {
  "site.name": "SubIO",
  "product.name": "اشتراک طلایی",
  today: new Date().toLocaleDateString("fa-IR"),
}

export function Playground() {
  const [html, setHtml] = useState(SAMPLE)
  const [showOutput, setShowOutput] = useState(true)

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">آزمایشگاه ویرایشگر محتوا</h1>
          <p className="text-sm text-muted-foreground">
            سطح ۳ — ویرایشگر کامل. این صفحه فقط برای تست داخلی فاز ۱ است.
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowOutput((v) => !v)}>
          {showOutput ? "پنهان‌سازی خروجی" : "نمایش خروجی"}
        </Button>
      </div>

      <RichContentEditor
        value={html}
        onChange={setHtml}
        draftKey="rich-content-lab"
        placeholder="بنویسید یا / را برای دستورات تایپ کنید…"
      />

      {showOutput && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">خروجی رندر شده (RichContent)</h2>
            <RichContent content={html} variables={DEMO_CONTEXT} showToc />
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">HTML ذخیره‌شده</h2>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
              <code>{html}</code>
            </pre>
          </Card>
        </div>
      )}
    </div>
  )
}
