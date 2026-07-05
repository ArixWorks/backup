"use client"

import { useState, type FormEvent } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GenerateButton, LocaleSelect, ResultCard, useContentTask } from "./toolkit"

interface Result {
  text: string
}

export function TranslateTool() {
  const [text, setText] = useState("")
  const [targetLocale, setTargetLocale] = useState("en")
  const { loading, result, run } = useContentTask<Result>()

  function submit(e: FormEvent) {
    e.preventDefault()
    run({ task: "translate", text, targetLocale })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tr-text">متن مبدأ</Label>
              <Textarea
                id="tr-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                placeholder="متنی که می‌خواهید ترجمه شود…"
                required
              />
            </div>
            <LocaleSelect value={targetLocale} onChange={setTargetLocale} />
            <GenerateButton loading={loading} disabled={text.length < 1} />
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {!result && !loading ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            ترجمه اینجا نمایش داده می‌شود.
          </p>
        ) : null}
        {result ? <ResultCard title="ترجمه" value={result.text} /> : null}
      </div>
    </div>
  )
}
