"use client"

import { useState, type FormEvent } from "react"
import useSWR from "swr"
import { Bot, CircleHelp, Clock3, Send, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { apiPost, fetcher } from "@/lib/api-client"
import { formatRelative } from "@/lib/format"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/components/i18n-provider"

type Question = {
  id: string
  body: string
  publicAlias: string
  status: "PENDING_AI" | "PENDING_ADMIN" | "ANSWERED"
  createdAt: string
  user: { displayName: string; photoUrl: string | null } | null
  answers: Array<{ id: string; body: string; source: "AI" | "ADMIN"; publishedAt: string | null }>
}

type Response = { data: { items: Question[] } }

export function ProductQuestions({ productId }: { productId: string }) {
  const { locale, dir } = useI18n()
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { data, isLoading, mutate } = useSWR<Response>(`/api/v1/products/${productId}/questions?locale=${locale}`, fetcher, {
    refreshInterval: 20_000,
  })
  const items = data?.data.items ?? []

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (body.trim().length < 8 || submitting) return
    setSubmitting(true)
    try {
      const result = await apiPost<{ data: { status: string } }>(`/api/v1/products/${productId}/questions`, { body })
      setBody("")
      await mutate()
      toast.success(
        result.data.status === "ANSWERED"
          ? "پاسخ مستند آماده و منتشر شد."
          : "پرسش ثبت شد و برای بررسی ادمین ارسال شد.",
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ثبت پرسش انجام نشد.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="overflow-hidden py-0" dir={dir}>
      <CardHeader className="border-b border-border bg-secondary/30 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-lg text-balance">
              <CircleHelp className="size-5 text-primary" aria-hidden="true" />
              پرسش و پاسخ محصول
            </CardTitle>
            <CardDescription className="leading-6 text-pretty">
              سؤال خود را بپرسید؛ پاسخ فقط بر پایه اطلاعات و تصاویر همین محصول ارائه می‌شود.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0">{items.filter((item) => item.status === "ANSWERED").length} پاسخ</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 py-5">
        <form onSubmit={submit} className="flex flex-col gap-3" aria-label="ثبت پرسش محصول">
          <label htmlFor={`product-question-${productId}`} className="text-sm font-semibold">
            پرسش شما
          </label>
          <Textarea
            id={`product-question-${productId}`}
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, 600))}
            placeholder="مثلاً این پلن روی چند دستگاه قابل استفاده است؟"
            rows={3}
            maxLength={600}
            disabled={submitting}
            aria-describedby={`question-help-${productId}`}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <div id={`question-help-${productId}`} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="size-4" aria-hidden="true" />پاسخ نامطمئن برای ادمین ارسال می‌شود.</span>
            <span className="tabular-nums">{body.length}/600</span>
          </div>
          <Button type="submit" disabled={submitting || body.trim().length < 8} className="w-full sm:w-fit">
            <Send data-icon="inline-start" aria-hidden="true" />
            {submitting ? "در حال بررسی…" : "ثبت پرسش"}
          </Button>
        </form>

        {isLoading ? (
          <div className="flex flex-col gap-3" role="status" aria-label="در حال دریافت پرسش‌ها">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center">
            <CircleHelp className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold">هنوز پرسشی ثبت نشده است.</p>
            <p className="text-xs text-muted-foreground">اولین نفری باشید که درباره این محصول سؤال می‌پرسد.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="پرسش‌های محصول">
            {items.map((question) => {
              const answer = question.answers[0]
              return (
                <li key={question.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9 shrink-0 border border-border">
                      {question.user?.photoUrl ? (
                        <AvatarImage
                          src={question.user.photoUrl}
                          alt={question.user.displayName}
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <AvatarFallback className="bg-secondary text-xs font-bold text-muted-foreground">
                        {(question.user?.displayName || question.publicAlias).trim().charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span dir="auto" className="font-semibold text-foreground">
                          {question.user?.displayName || question.publicAlias}
                        </span>
                        <span>{formatRelative(question.createdAt)}</span>
                      </div>
                      <p dir="auto" className="text-sm leading-6 text-pretty">{question.body}</p>
                    </div>
                  </div>
                  {answer ? (
                    <div className="me-0 flex gap-3 rounded-lg bg-secondary/50 p-3 sm:me-12">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {answer.source === "AI" ? <Bot className="size-4" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Badge variant="outline" className="w-fit">{answer.source === "AI" ? "پاسخ هوشمند" : "پاسخ ادمین"}</Badge>
                        <p dir="auto" className="text-sm leading-6 text-pretty">{answer.body}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-4" aria-hidden="true" />در انتظار بررسی ادمین</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
