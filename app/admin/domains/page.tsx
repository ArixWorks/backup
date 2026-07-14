"use client"

import { useState } from "react"
import useSWR from "swr"
import { Globe2, Loader2, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"
import { apiPatch, apiPost, fetcher } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Tld { id: string; tld: string; title: string; active: boolean; supported: boolean; basePriceIrt: string }
interface Order { id: string; publicId: string; asciiDomain: string; userId: string; status: string; amountIrt: string; failureReason?: string | null; createdAt: string }
interface Totals { status: string; _count: { _all: number }; _sum: { amountIrt: string | null } }
interface Data { tlds: Tld[]; orders: Order[]; totals: Totals[] }

const statusLabels: Record<string, string> = {
  PENDING_PURCHASE: "در صف",
  PROCESSING: "در حال ثبت",
  COMPLETED: "تکمیل",
  FAILED: "ناموفق",
  EXPIRED: "منقضی",
  CANCELLED: "لغو",
}
const money = (value: string | null | undefined) => `${Number(value ?? 0).toLocaleString("fa-IR")} تومان`

export default function AdminDomainsPage() {
  const { data, isLoading, mutate } = useSWR<{ data: Data }>("/api/v1/admin/domains", fetcher, { refreshInterval: 20_000 })
  const [drafts, setDrafts] = useState<Record<string, Partial<Tld>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const value = data?.data

  function patchDraft(id: string, patch: Partial<Tld>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  async function manageOrder(orderId: string, action: "complete" | "fail" | "extend") {
    setSaving(orderId)
    try {
      await apiPost("/api/v1/admin/domains", action === "fail"
        ? { action, orderId, reason: "ثبت دامنه توسط ارائه‌دهنده انجام نشد." }
        : action === "extend"
          ? { action, orderId, minutes: 1440 }
          : { action, orderId })
      toast.success(action === "complete" ? "سفارش تکمیل شد و مبلغ نهایی برداشت شد." : action === "extend" ? "مهلت سفارش ۲۴ ساعت تمدید شد." : "سفارش ناموفق شد و مبلغ آزاد شد.")
      await mutate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "عملیات سفارش انجام نشد.")
    } finally {
      setSaving(null)
    }
  }

  async function save(tld: Tld) {
    setSaving(tld.id)
    try {
      await apiPatch("/api/v1/admin/domains", { id: tld.id, ...drafts[tld.id] })
      toast.success(`تنظیمات ${tld.tld} ذخیره شد.`)
      setDrafts((current) => { const next = { ...current }; delete next[tld.id]; return next })
      await mutate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ذخیره تنظیمات انجام نشد.")
    } finally {
      setSaving(null)
    }
  }

  if (isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-3"><Globe2 className="size-7 text-primary" /><div><h1 className="text-2xl font-bold">عملیات دامنه</h1><p className="text-sm text-muted-foreground">قیمت‌گذاری، وضعیت ثبت و پایش خطاهای Provider</p></div></div>
        <Button variant="outline" onClick={() => void mutate()}><RefreshCw data-icon="inline-start" /> تازه‌سازی</Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="خلاصه سفارش‌ها">
        {(value?.totals ?? []).map((item) => (
          <Card key={item.status}><CardHeader><CardDescription>{statusLabels[item.status] ?? item.status}</CardDescription><CardTitle className="text-3xl">{item._count._all.toLocaleString("fa-IR")}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">ارزش: {money(item._sum.amountIrt)}</p></CardContent></Card>
        ))}
      </section>

      <Card>
        <CardHeader><CardTitle>پسوندها و قیمت‌گذاری</CardTitle><CardDescription>قیمت‌ها به تومان هستند و در زمان صدور پیش‌فاکتور امضا می‌شوند.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>پسوند</TableHead><TableHead>فعال</TableHead><TableHead>استعلام</TableHead><TableHead>قیمت ثبت</TableHead><TableHead className="text-left">عملیات</TableHead></TableRow></TableHeader>
            <TableBody>
              {(value?.tlds ?? []).map((tld) => {
                const draft = drafts[tld.id] ?? {}
                return (
                  <TableRow key={tld.id}>
                    <TableCell><strong dir="ltr">{tld.tld}</strong><span className="block text-xs text-muted-foreground">{tld.title}</span></TableCell>
                    <TableCell><Switch checked={draft.active ?? tld.active} onCheckedChange={(active) => patchDraft(tld.id, { active })} aria-label={`فعال‌سازی ${tld.tld}`} /></TableCell>
                    <TableCell><Switch checked={draft.supported ?? tld.supported} onCheckedChange={(supported) => patchDraft(tld.id, { supported })} aria-label={`پشتیبانی ${tld.tld}`} /></TableCell>
                    <TableCell><Input dir="ltr" className="min-w-36 text-left" value={draft.basePriceIrt ?? tld.basePriceIrt} onChange={(event) => patchDraft(tld.id, { basePriceIrt: event.target.value })} aria-label={`قیمت ${tld.tld}`} /></TableCell>
                    <TableCell className="text-left"><Button size="sm" onClick={() => void save(tld)} disabled={!drafts[tld.id] || saving !== null}>{saving === tld.id ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />} ذخیره</Button></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>آخرین سفارش‌ها</CardTitle><CardDescription>رخدادهای ناموفق با دلیل Provider برای بررسی عملیاتی نمایش داده می‌شوند.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>شناسه</TableHead><TableHead>دامنه</TableHead><TableHead>وضعیت</TableHead><TableHead>مبلغ</TableHead><TableHead>زمان</TableHead><TableHead>دلیل</TableHead><TableHead>عملیات</TableHead></TableRow></TableHeader>
            <TableBody>
              {(value?.orders ?? []).map((order) => {
                const actionable = ["PENDING_PURCHASE", "PROCESSING"].includes(order.status)
                return <TableRow key={order.id}><TableCell className="font-mono text-xs">{order.publicId}</TableCell><TableCell dir="ltr" className="text-left font-medium">{order.asciiDomain}</TableCell><TableCell><Badge variant="secondary">{statusLabels[order.status] ?? order.status}</Badge></TableCell><TableCell>{money(order.amountIrt)}</TableCell><TableCell>{new Date(order.createdAt).toLocaleString("fa-IR")}</TableCell><TableCell className="max-w-56 truncate text-xs text-muted-foreground">{order.failureReason ?? "—"}</TableCell><TableCell><div className="flex min-w-max gap-2">{actionable ? <><Button size="sm" onClick={() => void manageOrder(order.id, "complete")} disabled={saving !== null}>تکمیل</Button><Button size="sm" variant="outline" onClick={() => void manageOrder(order.id, "extend")} disabled={saving !== null}>تمدید ۲۴ ساعت</Button><Button size="sm" variant="destructive" onClick={() => void manageOrder(order.id, "fail")} disabled={saving !== null}>ناموفق</Button></> : <span className="text-xs text-muted-foreground">بسته شده</span>}</div></TableCell></TableRow>
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}
