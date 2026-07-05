"use client"

import { useState, type FormEvent } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GenerateButton, LocaleSelect, ResultCard, ToneSelect, useContentTask } from "./toolkit"

interface Result {
  title: string
  body: string
}

const CHANNELS = [
  { value: "app", label: "اعلان داخل برنامه" },
  { value: "telegram", label: "تلگرام" },
  { value: "email", label: "ایمیل" },
]

export function AnnouncementTool() {
  const [topic, setTopic] = useState("")
  const [points, setPoints] = useState("")
  const [channel, setChannel] = useState("app")
  const [locale, setLocale] = useState("fa")
  const [tone, setTone] = useState("friendly")
  const { loading, result, run } = useContentTask<Result>()

  function submit(e: FormEvent) {
    e.preventDefault()
    run({ task: "announcement", topic, points: points || undefined, channel, locale, tone })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="an-topic">موضوع اعلان</Label>
              <Input
                id="an-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثلاً تخفیف ویژه آخر هفته"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="an-points">نکات کلیدی (اختیاری)</Label>
              <Textarea id="an-points" value={points} onChange={(e) => setPoints(e.target.value)} rows={3} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>کانال</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v ?? "app")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <LocaleSelect value={locale} onChange={setLocale} />
              <ToneSelect value={tone} onChange={setTone} />
            </div>
            <GenerateButton loading={loading} disabled={topic.length < 2} />
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {!result && !loading ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            متن اعلان اینجا نمایش داده می‌شود.
          </p>
        ) : null}
        {result ? (
          <>
            <ResultCard title="عنوان" value={result.title} />
            <ResultCard title="متن اعلان" value={result.body} />
          </>
        ) : null}
      </div>
    </div>
  )
}
