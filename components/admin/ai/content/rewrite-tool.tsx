"use client"

import { useState, type FormEvent } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GenerateButton, LocaleSelect, ResultCard, ToneSelect, useContentTask } from "./toolkit"

interface Result {
  text: string
}

export function RewriteTool() {
  const [text, setText] = useState("")
  const [instruction, setInstruction] = useState("")
  const [locale, setLocale] = useState("fa")
  const [tone, setTone] = useState("professional")
  const { loading, result, run } = useContentTask<Result>()

  function submit(e: FormEvent) {
    e.preventDefault()
    run({ task: "rewrite", text, instruction: instruction || undefined, locale, tone })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rw-text">متن اصلی</Label>
              <Textarea
                id="rw-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rw-inst">دستور بازنویسی (اختیاری)</Label>
              <Input
                id="rw-inst"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="مثلاً کوتاه‌تر و رسمی‌تر کن"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LocaleSelect value={locale} onChange={setLocale} />
              <ToneSelect value={tone} onChange={setTone} />
            </div>
            <GenerateButton loading={loading} disabled={text.length < 1} />
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {!result && !loading ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            متن بازنویسی‌شده اینجا نمایش داده می‌شود.
          </p>
        ) : null}
        {result ? <ResultCard title="نتیجه" value={result.text} /> : null}
      </div>
    </div>
  )
}
