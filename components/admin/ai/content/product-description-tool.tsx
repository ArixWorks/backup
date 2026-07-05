"use client"

import { useState, type FormEvent } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  GenerateButton,
  LocaleSelect,
  ResultCard,
  ToneSelect,
  useContentTask,
} from "./toolkit"

interface Result {
  shortDescription: string
  description: string
  bullets: string[]
}

export function ProductDescriptionTool() {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [tags, setTags] = useState("")
  const [notes, setNotes] = useState("")
  const [locale, setLocale] = useState("fa")
  const [tone, setTone] = useState("professional")
  const { loading, result, run } = useContentTask<Result>()

  function submit(e: FormEvent) {
    e.preventDefault()
    run({
      task: "product_description",
      title,
      category: category || undefined,
      tags: tags ? tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean) : undefined,
      notes: notes || undefined,
      locale,
      tone,
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pd-title">عنوان محصول</Label>
              <Input
                id="pd-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً اشتراک یک‌ماهه پرمیوم"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pd-cat">دسته‌بندی (اختیاری)</Label>
              <Input id="pd-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pd-tags">برچسب‌ها (با کاما جدا کنید)</Label>
              <Input id="pd-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pd-notes">نکات مهم (اختیاری)</Label>
              <Textarea id="pd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LocaleSelect value={locale} onChange={setLocale} />
              <ToneSelect value={tone} onChange={setTone} />
            </div>
            <GenerateButton loading={loading} disabled={title.length < 2} />
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {!result && !loading ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            نتیجه تولیدشده اینجا نمایش داده می‌شود.
          </p>
        ) : null}
        {result ? (
          <>
            <ResultCard title="توضیح کوتاه" value={result.shortDescription} />
            <ResultCard title="توضیح کامل" value={result.description} />
            <ResultCard title="ویژگی‌های کلیدی">
              <ul className="flex flex-col gap-1.5">
                {result.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant="secondary" className="mt-0.5 shrink-0">
                      {i + 1}
                    </Badge>
                    <span className="leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </ResultCard>
          </>
        ) : null}
      </div>
    </div>
  )
}
