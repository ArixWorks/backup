"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import useSWR, { mutate as mutateCache } from "swr"
import { Bot, Check, CircleHelp, Clock3, EyeOff, Search, ShieldCheck, X } from "lucide-react"
import { toast } from "sonner"
import { apiPatch, fetcher } from "@/lib/api-client"
import { formatRelative } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

type Status = "PENDING_AI" | "PENDING_ADMIN" | "ANSWERED" | "REJECTED" | "HIDDEN"
type Item = {
  id: string
  body: string
  publicAlias: string
  status: Status
  aiConfidence: number | null
  aiReason: string | null
  aiEvidence: string[] | null
  createdAt: string
  product: {
    id: string
    title: string
    saleMode: "FIXED_PRICE" | "AUCTION"
    coverImage: string | null
    description: string | null
    auction: { id: string } | null
  }
  answers: Array<{ id: string; body: string; source: "AI" | "ADMIN"; published: boolean }>
}
type Response = { data: { items: Item[]; pending: number } }

const statuses: Array<{ value: "" | Status; label: string }> = [
  { value: "PENDING_ADMIN", label: "نیازمند بررسی" },
  { value: "", label: "همه" },
  { value: "ANSWERED", label: "پاسخ‌داده‌شده" },
  { value: "REJECTED", label: "ردشده" },
  { value: "HIDDEN", label: "مخفی" },
]

export default function AdminProductQuestionsPage() {
  const [status, setStatus] = useState<"" | Status>("PENDING_ADMIN")
  const [search, setSearch] = useState("")
  const query = new URLSearchParams()
  if (status) query.set("status", status)
  if (search.trim()) query.set("search", search.trim())
  const { data, isLoading, mutate } = useSWR<Response>(`/api/v1/admin/ai/questions?${query}`, fetcher)
  const items = data?.data.items ?? []

  return (
    <main className="flex flex-col gap-5" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-balance">
            <CircleHelp className="size-6 text-primary" aria-hidden="true" />
            صف پرسش‌های محصول
          </h1>
          <p className="text-sm leading-6 text-muted-foreground text-pretty">پاسخ‌های نامطمئن AI را بررسی، ویرایش و منتشر کنید.</p>
        </div>
        <Badge variant={data?.data.pending ? "destructive" : "secondary"}>{data?.data.pending ?? 0} در انتظار</Badge>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={(event) => setSearch(event.target.value.slice(0, 100))} placeholder="جست‌وجوی پرسش یا محصول" className="pe-9" />
            <span className="sr-only">جست‌وجوی پرسش‌ها</span>
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="فیلتر وضعیت">
            {statuses.map((option) => (
              <Button key={option.value || "all"} type="button" size="sm" variant={status === option.value ? "default" : "outline"} onClick={() => setStatus(option.value)}>
                {option.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-3" role="status"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center"><ShieldCheck className="size-10 text-muted-foreground" /><p className="font-bold">موردی در این صف نیست.</p></CardContent></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => <QuestionCard key={item.id} item={item} onChanged={mutate} />)}
        </div>
      )}
    </main>
  )
}

function QuestionCard({ item, onChanged }: { item: Item; onChanged: () => Promise<unknown> }) {
  const draft = item.answers.find((answer) => !answer.published)?.body ?? item.answers[0]?.body ?? ""
  const [body, setBody] = useState(draft)
  const [saving, setSaving] = useState(false)
  const productHref =
    item.product.saleMode === "AUCTION" && item.product.auction
      ? `/auctions/${item.product.auction.id}`
      : `/flash/${item.product.id}`

  async function act(action: "publish" | "reject" | "hide") {
    if (action === "publish" && body.trim().length < 3) return toast.error("متن پاسخ الزامی است.")
    setSaving(true)
    try {
      await apiPatch(`/api/v1/admin/ai/questions/${item.id}`, { action, body: body.trim() })
      toast.success(action === "publish" ? "پاسخ منتشر شد." : action === "reject" ? "پرسش رد شد." : "پرسش مخفی شد.")
      await Promise.all([onChanged(), mutateCache("/api/v1/admin/ai/questions?summary=1")])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "انجام عملیات ناموفق بود.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          {item.product.coverImage ? <Image src={item.product.coverImage} alt="" width={64} height={64} className="size-16 shrink-0 rounded-lg object-cover" /> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle className="text-base text-balance"><Link href={productHref} className="hover:text-primary">{item.product.title}</Link></CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2"><span>{item.publicAlias}</span><span>{formatRelative(item.createdAt)}</span><Badge variant="outline">{item.product.saleMode === "AUCTION" ? "مزایده" : "فروش ثابت"}</Badge></CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg bg-secondary/60 p-4"><p dir="auto" className="text-sm leading-6 text-pretty">{item.body}</p></div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Bot className="size-4" aria-hidden="true" />
          <span>اطمینان AI: {item.aiConfidence == null ? "نامشخص" : `${Math.round(item.aiConfidence * 100)}٪`}</span>
          {item.aiReason ? <span className="text-pretty">· {item.aiReason}</span> : null}
        </div>
        {Array.isArray(item.aiEvidence) && item.aiEvidence.length ? <ul className="flex list-inside list-disc flex-col gap-1 text-xs text-muted-foreground">{item.aiEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul> : null}
        <label className="flex flex-col gap-2 text-sm font-semibold">پاسخ نهایی<Textarea value={body} onChange={(event) => setBody(event.target.value.slice(0, 2000))} rows={5} maxLength={2000} disabled={saving} /></label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={saving || body.trim().length < 3} onClick={() => act("publish")}><Check data-icon="inline-start" />انتشار پاسخ</Button>
          <Button disabled={saving} variant="outline" onClick={() => act("reject")}><X data-icon="inline-start" />رد پرسش</Button>
          <Button disabled={saving} variant="ghost" onClick={() => act("hide")}><EyeOff data-icon="inline-start" />مخفی‌سازی</Button>
          {item.status === "PENDING_ADMIN" ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-4" />در انتظار بررسی</span> : null}
        </div>
      </CardContent>
    </Card>
  )
}
