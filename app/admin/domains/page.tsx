"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign, Download, FileSpreadsheet, Globe2, Loader2, Plus, RefreshCw, Save, Search, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { apiPatch, apiPost, fetcher } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Tld { id: string; tld: string; title: string; active: boolean; supported: boolean; basePriceIrt: string; displayOrder: number; updatedAt: string }
interface Order { id: string; publicId: string; asciiDomain: string; status: string; amountIrt: string; failureReason?: string | null; createdAt: string }
interface Totals { status: string; _count: { _all: number }; _sum: { amountIrt: string | null } }
interface Data { tlds: Tld[]; orders: Order[]; totals: Totals[]; pagination: { page: number; pageSize: number; total: number; pages: number }; catalog: { total: number; active: number } }
interface ImportRow { tld: string; title: string; basePriceIrt: string; active: boolean }

const statusLabels: Record<string, string> = { PENDING_PURCHASE: "در صف", PROCESSING: "در حال ثبت", COMPLETED: "تکمیل", FAILED: "ناموفق", EXPIRED: "منقضی", CANCELLED: "لغو" }
const money = (value: string | null | undefined) => `${Number(value ?? 0).toLocaleString("fa-IR")} تومان`

function parseCsv(source: string): ImportRow[] {
  return source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [rawTld, rawTitle, rawPrice, rawActive = "true"] = line.split(",").map((part) => part.trim())
    if (index === 0 && rawTld?.toLowerCase() === "tld") return null
    const tld = rawTld?.startsWith(".") ? rawTld.toLowerCase() : `.${rawTld?.toLowerCase()}`
    if (!/^\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tld) || !rawTitle || !/^\d+$/.test(rawPrice ?? "") || Number(rawPrice) <= 0) throw new Error(`ردیف ${index + 1} معتبر نیست.`)
    return { tld, title: rawTitle, basePriceIrt: rawPrice, active: !["false", "0", "غیرفعال"].includes(rawActive.toLowerCase()) }
  }).filter((row): row is ImportRow => row !== null)
}

export default function AdminDomainsPage() {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const endpoint = `/api/v1/admin/domains?q=${encodeURIComponent(query)}&status=${status}&page=${page}&pageSize=25`
  const { data, isLoading, mutate } = useSWR<{ data: Data }>(endpoint, fetcher, { refreshInterval: 20_000 })
  const value = data?.data
  const [drafts, setDrafts] = useState<Record<string, Partial<Tld>>>({})
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [create, setCreate] = useState({ tld: "", title: "", basePriceIrt: "", active: true })
  const [csv, setCsv] = useState("tld,title,basePriceIrt,active\n.com,تجاری,890000,true")
  const [preview, setPreview] = useState<ImportRow[]>([])
  const allSelected = useMemo(() => Boolean(value?.tlds.length) && value!.tlds.every((row) => selected.includes(row.id)), [selected, value])

  function patchDraft(id: string, patch: Partial<Tld>) { setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } })) }
  async function refresh() { setSelected([]); await mutate() }

  async function save(tld: Tld) {
    setSaving(tld.id)
    try { await apiPatch("/api/v1/admin/domains", { id: tld.id, ...drafts[tld.id] }); toast.success(`تغییرات ${tld.tld} ذخیره شد.`); setDrafts((current) => { const next = { ...current }; delete next[tld.id]; return next }); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : "ذخیره انجام نشد.") } finally { setSaving(null) }
  }

  async function createTld() {
    setSaving("create")
    try { await apiPost("/api/v1/admin/domains", { action: "createTld", ...create }); toast.success("پسوند به کاتالوگ اضافه شد."); setCreate({ tld: "", title: "", basePriceIrt: "", active: true }); setCreateOpen(false); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : "افزودن پسوند انجام نشد.") } finally { setSaving(null) }
  }

  function previewCsv() { try { const rows = parseCsv(csv); if (!rows.length) throw new Error("فایل داده‌ای ندارد."); setPreview(rows) } catch (error) { setPreview([]); toast.error(error instanceof Error ? error.message : "CSV معتبر نیست.") } }
  async function importCsv() {
    setSaving("import")
    try { await apiPost("/api/v1/admin/domains", { action: "importTlds", rows: preview }); toast.success(`${preview.length.toLocaleString("fa-IR")} پسوند وارد شد.`); setPreview([]); setCsvOpen(false); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : "ورود گروهی انجام نشد.") } finally { setSaving(null) }
  }

  async function bulkStatus(active: boolean) {
    setSaving("bulk")
    try { await apiPost("/api/v1/admin/domains", { action: "bulkStatus", ids: selected, active }); toast.success(active ? "پسوندهای انتخابی فعال شدند." : "پسوندهای انتخابی غیرفعال شدند."); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : "عملیات گروهی انجام نشد.") } finally { setSaving(null) }
  }

  async function deleteTld(tld: Tld) {
    if (!window.confirm(`پسوند ${tld.tld} برای همیشه از کاتالوگ حذف شود؟ این پسوند دیگر در فروش و جست‌وجو نمایش داده نمی‌شود؛ سوابق سفارش‌های قبلی محفوظ می‌ماند.`)) return
    setSaving(tld.id)
    try { await apiPost("/api/v1/admin/domains", { action: "deleteTld", id: tld.id }); toast.success(`${tld.tld} از کاتالوگ حذف شد.`); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : "حذف پسوند انجام نشد.") } finally { setSaving(null) }
  }

  async function manageOrder(orderId: string, action: "complete" | "fail" | "unavailable" | "extend") {
    if (action === "unavailable" && !window.confirm("این دامنه قبلاً ثبت شده است؟ سفارش ناموفق می‌شود، وجه فریز‌شده کامل آزاد و به کاربر اطلاع داده خواهد شد.")) return
    setSaving(orderId)
    try { await apiPost("/api/v1/admin/domains", action === "fail" ? { action, orderId, reason: "ثبت دامنه انجام نشد." } : action === "extend" ? { action, orderId, minutes: 1440 } : { action, orderId }); toast.success(action === "unavailable" ? "سفارش بسته، وجه آزاد و کاربر مطلع شد." : "وضعیت سفارش به‌روزرسانی شد."); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : "عملیات سفارش انجام نشد.") } finally { setSaving(null) }
  }

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex items-start gap-3"><div className="rounded-xl border border-primary/25 bg-primary/10 p-2.5"><Globe2 className="size-6 text-primary" /></div><div><h1 className="text-2xl font-bold text-balance">مرکز عملیات دامنه</h1><p className="mt-1 text-sm text-muted-foreground">مدیریت کاتالوگ فروش، قیمت ثبت و گردش سفارش‌ها</p></div></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void refresh()}><RefreshCw data-icon="inline-start" />تازه‌سازی</Button><Button variant="outline" onClick={() => setCsvOpen(true)}><FileSpreadsheet data-icon="inline-start" />ورود CSV</Button><Button onClick={() => setCreateOpen(true)}><Plus data-icon="inline-start" />افزودن پسوند</Button></div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="نمای کلی">
        <Card><CardHeader><CardDescription>کل کاتالوگ</CardDescription><CardTitle className="text-3xl">{(value?.catalog.total ?? 0).toLocaleString("fa-IR")}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">پسوند تعریف‌شده</p></CardContent></Card>
        <Card><CardHeader><CardDescription>فعال برای فروش</CardDescription><CardTitle className="flex items-center gap-2 text-3xl"><CheckCircle2 className="size-5 text-primary" />{(value?.catalog.active ?? 0).toLocaleString("fa-IR")}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">در جست‌وجوی کاربران نمایش داده می‌شود</p></CardContent></Card>
        <Card><CardHeader><CardDescription>سفارش‌های باز</CardDescription><CardTitle className="text-3xl">{(value?.totals ?? []).filter((item) => ["PENDING_PURCHASE", "PROCESSING"].includes(item.status)).reduce((sum, item) => sum + item._count._all, 0).toLocaleString("fa-IR")}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">نیازمند پایش یا اقدام</p></CardContent></Card>
        <Card><CardHeader><CardDescription>فروش تکمیل‌شده</CardDescription><CardTitle className="flex items-center gap-2 text-2xl"><CircleDollarSign className="size-5 text-primary" />{money((value?.totals ?? []).find((item) => item.status === "COMPLETED")?._sum.amountIrt)}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">مجموع سفارش‌های نهایی</p></CardContent></Card>
      </section>

      <Card>
        <CardHeader className="gap-4"><div><CardTitle>کاتالوگ پسوندها</CardTitle><CardDescription>پسوند، عنوان و قیمت ثبت را مدیریت کنید؛ حذف از کاتالوگ، سوابق مالی سفارش‌های قبلی را تغییر نمی‌دهد.</CardDescription></div><div className="flex flex-col gap-2 md:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pr-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="جست‌وجوی پسوند یا عنوان..." /></div><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="فیلتر وضعیت"><option value="all">همه وضعیت‌ها</option><option value="active">فعال</option><option value="inactive">غیرفعال / آرشیو</option></select></div>{selected.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3"><span className="text-sm font-medium">{selected.length.toLocaleString("fa-IR")} انتخاب</span><Button size="sm" variant="outline" onClick={() => void bulkStatus(true)} disabled={saving !== null}>فعال‌سازی</Button><Button size="sm" variant="outline" onClick={() => void bulkStatus(false)} disabled={saving !== null}>غیرفعال‌سازی</Button><Button size="sm" variant="ghost" onClick={() => setSelected([])}>لغو انتخاب</Button></div>}</CardHeader>
        <CardContent className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? (value?.tlds ?? []).map((row) => row.id) : [])} aria-label="انتخاب همه" /></TableHead><TableHead>پسوند</TableHead><TableHead>عنوان</TableHead><TableHead>وضعیت فروش</TableHead><TableHead>قیمت ثبت</TableHead><TableHead>ترتیب</TableHead><TableHead>عملیات</TableHead></TableRow></TableHeader>
            <TableBody>{isLoading ? <TableRow><TableCell colSpan={7} className="h-36 text-center"><Loader2 className="mx-auto size-5 animate-spin text-primary" /></TableCell></TableRow> : (value?.tlds ?? []).length === 0 ? <TableRow><TableCell colSpan={7} className="h-36 text-center text-muted-foreground">پسوندی با این فیلتر پیدا نشد.</TableCell></TableRow> : (value?.tlds ?? []).map((tld) => { const draft = drafts[tld.id] ?? {}; const enabled = (draft.active ?? tld.active) && (draft.supported ?? tld.supported); return <TableRow key={tld.id}><TableCell><input type="checkbox" checked={selected.includes(tld.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, tld.id] : current.filter((id) => id !== tld.id))} aria-label={`انتخاب ${tld.tld}`} /></TableCell><TableCell><strong dir="ltr" className="text-base">{tld.tld}</strong></TableCell><TableCell><Input className="min-w-32" value={draft.title ?? tld.title} onChange={(event) => patchDraft(tld.id, { title: event.target.value })} /></TableCell><TableCell><div className="flex min-w-max items-center gap-2"><Switch checked={enabled} onCheckedChange={(active) => patchDraft(tld.id, { active, supported: active })} aria-label={`وضعیت ${tld.tld}`} /><Badge variant={enabled ? "default" : "secondary"}>{enabled ? "فعال" : "غیرفعال"}</Badge></div></TableCell><TableCell><Input dir="ltr" className="min-w-36 text-left" inputMode="numeric" value={draft.basePriceIrt ?? tld.basePriceIrt} onChange={(event) => patchDraft(tld.id, { basePriceIrt: event.target.value })} /></TableCell><TableCell><Input dir="ltr" className="w-20 text-left" inputMode="numeric" value={draft.displayOrder ?? tld.displayOrder} onChange={(event) => patchDraft(tld.id, { displayOrder: Number(event.target.value) })} /></TableCell><TableCell><div className="flex min-w-max gap-2"><Button size="sm" onClick={() => void save(tld)} disabled={!drafts[tld.id] || saving !== null}>{saving === tld.id ? <Loader2 className="animate-spin" /> : <Save />}<span className="sr-only">ذخیره {tld.tld}</span></Button><Button size="sm" variant="outline" onClick={() => void deleteTld(tld)} disabled={saving !== null}><Trash2 /><span className="sr-only">آرشیو {tld.tld}</span></Button></div></TableCell></TableRow> })}</TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{(value?.pagination.total ?? 0).toLocaleString("fa-IR")} نتیجه · صفحه {(value?.pagination.page ?? 1).toLocaleString("fa-IR")} از {(value?.pagination.pages ?? 1).toLocaleString("fa-IR")}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronRight />قبلی</Button><Button size="sm" variant="outline" disabled={page >= (value?.pagination.pages ?? 1)} onClick={() => setPage((current) => current + 1)}>بعدی<ChevronLeft /></Button></div></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>گردش سفارش‌های دامنه</CardTitle><CardDescription>سفارش‌های باز را تکمیل، تمدید یا با آزادسازی وجه ناموفق کنید.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>شناسه</TableHead><TableHead>دامنه</TableHead><TableHead>وضعیت</TableHead><TableHead>مبلغ</TableHead><TableHead>زمان</TableHead><TableHead>دلیل</TableHead><TableHead>عملیات</TableHead></TableRow></TableHeader><TableBody>{(value?.orders ?? []).map((order) => { const actionable = ["PENDING_PURCHASE", "PROCESSING"].includes(order.status); return <TableRow key={order.id}><TableCell className="font-mono text-xs">{order.publicId}</TableCell><TableCell dir="ltr" className="text-left font-medium">{order.asciiDomain}</TableCell><TableCell><Badge variant="secondary">{statusLabels[order.status] ?? order.status}</Badge></TableCell><TableCell>{money(order.amountIrt)}</TableCell><TableCell>{new Date(order.createdAt).toLocaleString("fa-IR")}</TableCell><TableCell className="max-w-56 truncate text-xs text-muted-foreground">{order.failureReason ?? "—"}</TableCell><TableCell>{actionable ? <div className="flex min-w-max gap-2"><Button size="sm" onClick={() => void manageOrder(order.id, "complete")} disabled={saving !== null}>تکمیل</Button><Button size="sm" variant="outline" onClick={() => void manageOrder(order.id, "extend")} disabled={saving !== null}>تمدید</Button><Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => void manageOrder(order.id, "unavailable")} disabled={saving !== null}>قبلاً ثبت شده</Button><Button size="sm" variant="destructive" onClick={() => void manageOrder(order.id, "fail")} disabled={saving !== null}>ناموفق</Button></div> : <span className="text-xs text-muted-foreground">بسته شده</span>}</TableCell></TableRow> })}</TableBody></Table></CardContent></Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>افزودن پسوند جدید</DialogTitle><DialogDescription>پسوند پس از ذخیره بلافاصله وارد کاتالوگ جست‌وجو می‌شود.</DialogDescription></DialogHeader><DialogBody className="flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-medium">پسوند<Input dir="ltr" className="text-left" placeholder=".com" value={create.tld} onChange={(event) => setCreate((current) => ({ ...current, tld: event.target.value }))} /></label><label className="flex flex-col gap-2 text-sm font-medium">عنوان<Input placeholder="تجاری" value={create.title} onChange={(event) => setCreate((current) => ({ ...current, title: event.target.value }))} /></label><label className="flex flex-col gap-2 text-sm font-medium">قیمت ثبت به تومان<Input dir="ltr" className="text-left" inputMode="numeric" placeholder="890000" value={create.basePriceIrt} onChange={(event) => setCreate((current) => ({ ...current, basePriceIrt: event.target.value }))} /></label><label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm font-medium">فعال برای فروش<Switch checked={create.active} onCheckedChange={(active) => setCreate((current) => ({ ...current, active }))} /></label></DialogBody><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>انصراف</Button><Button onClick={() => void createTld()} disabled={saving !== null || !create.tld || !create.title || !create.basePriceIrt}>{saving === "create" && <Loader2 className="animate-spin" />}افزودن به کاتالوگ</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={csvOpen} onOpenChange={setCsvOpen}><DialogContent size="xl"><DialogHeader><DialogTitle>ورود گروهی پسوندها</DialogTitle><DialogDescription>ستون‌ها به ترتیب tld، title، basePriceIrt و active هستند. حداکثر ۵۰۰ ردیف.</DialogDescription></DialogHeader><DialogBody className="flex flex-col gap-4"><textarea dir="ltr" className="min-h-44 rounded-lg border border-input bg-background p-3 font-mono text-sm text-left" value={csv} onChange={(event) => { setCsv(event.target.value); setPreview([]) }} aria-label="محتوای CSV" /><Button variant="outline" onClick={previewCsv}><Upload data-icon="inline-start" />اعتبارسنجی و پیش‌نمایش</Button>{preview.length > 0 && <div className="rounded-lg border"><div className="flex items-center justify-between border-b p-3"><strong>{preview.length.toLocaleString("fa-IR")} ردیف معتبر</strong><Download className="size-4 text-primary" /></div><div className="max-h-52 overflow-auto p-3"><div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground"><span>پسوند</span><span>عنوان</span><span>قیمت</span>{preview.slice(0, 50).map((row) => <div className="contents" key={row.tld}><span dir="ltr" className="text-left text-foreground">{row.tld}</span><span className="text-foreground">{row.title}</span><span className="text-foreground">{money(row.basePriceIrt)}</span></div>)}</div></div></div>}</DialogBody><DialogFooter><Button variant="outline" onClick={() => setCsvOpen(false)}>انصراف</Button><Button onClick={() => void importCsv()} disabled={!preview.length || saving !== null}>{saving === "import" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}ورود {preview.length ? preview.length.toLocaleString("fa-IR") : ""} پسوند</Button></DialogFooter></DialogContent></Dialog>
    </main>
  )
}
