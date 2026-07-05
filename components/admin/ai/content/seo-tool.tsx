"use client"

import { useState, type FormEvent } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { GenerateButton, LocaleSelect, ResultCard, useContentTask } from "./toolkit"

interface Result {
  metaTitle: string
  metaDescription: string
  keywords: string[]
}

export function SeoTool() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [locale, setLocale] = useState("fa")
  const { loading, result, run } = useContentTask<Result>()

  function submit(e: FormEvent) {
    e.preventDefault()
    run({ task: "seo", title, description: description || undefined, locale })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seo-title">عنوان صفحه / محصول</Label>
              <Input id="seo-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="seo-desc">توضیح یا محتوای موجود (اختیاری)</Label>
              <Textarea
                id="seo-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>
            <LocaleSelect value={locale} onChange={setLocale} />
            <GenerateButton loading={loading} disabled={title.length < 2} />
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {!result && !loading ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            متادیتای سئو اینجا نمایش داده می‌شود.
          </p>
        ) : null}
        {result ? (
          <>
            <ResultCard title="عنوان متا" value={result.metaTitle} />
            <ResultCard title="توضیح متا" value={result.metaDescription} />
            <ResultCard title="کلمات کلیدی">
              <div className="flex flex-wrap gap-1.5">
                {result.keywords.map((k, i) => (
                  <Badge key={i} variant="secondary">
                    {k}
                  </Badge>
                ))}
              </div>
            </ResultCard>
          </>
        ) : null}
      </div>
    </div>
  )
}
