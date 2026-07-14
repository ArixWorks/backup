"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  CheckCircle2,
  Clock3,
  Globe2,
  History,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { apiGet, apiPost } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Tld { id: string; tld: string; title: string; basePriceIrt: string }
interface Lookup {
  asciiDomain: string
  unicodeDomain: string
  tld: string
  status: "AVAILABLE" | "REGISTERED" | "UNSUPPORTED" | "UNKNOWN" | "LOOKUP_ERROR" | "PREMIUM" | "RESERVED"
  priceIrt: string | null
  checkedAt: string
}
interface DomainOrder {
  id: string
  publicId: string
  asciiDomain: string
  status: string
  amountIrt: string
  createdAt: string
  holdExpiresAt: string
  events: Array<{ id: string; message: string; createdAt: string }>
}

const unwrap = <T,>(response: { data: T }) => response.data
const money = (value: string | number) => `${Number(value).toLocaleString("fa-IR")} تومان`
const statusMeta: Record<string, { label: string; icon: typeof CheckCircle2 }> = {
  AVAILABLE: { label: "قابل ثبت", icon: CheckCircle2 },
  REGISTERED: { label: "ثبت شده", icon: XCircle },
  UNSUPPORTED: { label: "پشتیبانی نمی‌شود", icon: XCircle },
  UNKNOWN: { label: "نامشخص", icon: Clock3 },
  LOOKUP_ERROR: { label: "خطا در استعلام", icon: XCircle },
  PENDING_PURCHASE: { label: "در صف ثبت", icon: Clock3 },
  PROCESSING: { label: "در حال ثبت", icon: Loader2 },
  COMPLETED: { label: "تکمیل شده", icon: CheckCircle2 },
  FAILED: { label: "ناموفق؛ بازپرداخت شد", icon: XCircle },
  EXPIRED: { label: "منقضی؛ بازپرداخت شد", icon: XCircle },
}

export function DomainMarketplace() {
  const [query, setQuery] = useState("")
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [busy, setBusy] = useState<"lookup" | "quote" | "ai" | null>(null)
  const [suggestionPrompt, setSuggestionPrompt] = useState("")
  const [suggestions, setSuggestions] = useState<Array<{ domain: string; reason: string }>>([])
  const { data: tldResponse } = useSWR<{ data: { tlds: Tld[] } }>("/api/v1/domains/tlds", apiGet)
  const { data: ordersResponse, mutate: mutateOrders } = useSWR<{ data: { orders: DomainOrder[]; domains: unknown[] } }>(
    "/api/v1/domains/orders",
    apiGet,
  )
  const tlds = tldResponse?.data.tlds ?? []
  const orders = ordersResponse?.data.orders ?? []

  const normalizedQuery = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed || trimmed.includes(".")) return trimmed
    return `${trimmed}${tlds[0]?.tld ?? ".ir"}`
  }, [query, tlds])

  async function searchDomain(domain = normalizedQuery) {
    if (!domain) return
    setBusy("lookup")
    try {
      const result = unwrap<Lookup>(await apiPost("/api/v1/domains/lookup", { domain }))
      setLookup(result)
      setQuery(result.asciiDomain)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "استعلام دامنه انجام نشد.")
    } finally {
      setBusy(null)
    }
  }

  async function purchase() {
    if (!lookup) return
    setBusy("quote")
    try {
      const quote = unwrap<{ id: string }>(await apiPost("/api/v1/domains/quote", { domain: lookup.asciiDomain }))
      const idempotencyKey = crypto.randomUUID()
      await apiPost("/api/v1/domains/purchase", { quoteId: quote.id, idempotencyKey })
      toast.success("سفارش ثبت شد؛ وضعیت آن را از بخش سفارش‌ها دنبال کنید.")
      setLookup(null)
      await mutateOrders()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خرید دامنه انجام نشد.")
    } finally {
      setBusy(null)
    }
  }

  async function generateSuggestions() {
    if (suggestionPrompt.trim().length < 2) return
    setBusy("ai")
    try {
      const result = unwrap<{ suggestions: Array<{ domain: string; reason: string }> }>(
        await apiPost("/api/v1/domains/suggestions", { prompt: suggestionPrompt }),
      )
      setSuggestions(result.suggestions)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "پیشنهاد هوشمند آماده نشد.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-10" dir="rtl">
      <header className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit"><ShieldCheck data-icon="inline-start" /> ثبت امن و شفاف</Badge>
        <div className="flex flex-col gap-2">
          <h1 className="max-w-3xl text-balance text-3xl font-bold tracking-tight md:text-5xl">دامنه‌ای که برندتان با آن شروع می‌شود</h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">استعلام لحظه‌ای، قیمت قطعی و پیگیری ثبت؛ بدون هزینه پنهان.</p>
        </div>
      </header>

      <Tabs defaultValue="search" className="flex flex-col gap-5">
        <TabsList className="w-full md:w-fit">
          <TabsTrigger value="search"><Search data-icon="inline-start" /> جستجو</TabsTrigger>
          <TabsTrigger value="smart"><Sparkles data-icon="inline-start" /> پیشنهاد هوشمند</TabsTrigger>
          <TabsTrigger value="orders"><History data-icon="inline-start" /> سفارش‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>نام دامنه را بررسی کنید</CardTitle>
              <CardDescription>دامنه کامل یا فقط نام برند را وارد کنید.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row">
              <Input
                dir="ltr"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) void searchDomain()
                }}
                placeholder="example.ir"
                aria-label="نام دامنه"
                className="h-12 text-left"
              />
              <Button size="lg" onClick={() => void searchDomain()} disabled={!normalizedQuery || busy !== null}>
                {busy === "lookup" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Search data-icon="inline-start" />}
                استعلام دامنه
              </Button>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              {tlds.map((item) => (
                <Button key={item.id} variant="outline" size="sm" onClick={() => setQuery(`${query.split(".")[0]}${item.tld}`)}>
                  <span dir="ltr">{item.tld}</span>
                  <span className="text-muted-foreground">{money(item.basePriceIrt)}</span>
                </Button>
              ))}
            </CardFooter>
          </Card>

          {lookup && <AvailabilityCard lookup={lookup} busy={busy === "quote"} onPurchase={purchase} />}

          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: Globe2, title: "استعلام زنده", text: "وضعیت دامنه مستقیماً از سرویس رجیستری بررسی می‌شود." },
              { icon: WalletCards, title: "تسویه امن", text: "مبلغ قطعی از کیف پول کسر و در شکست ثبت، خودکار بازپرداخت می‌شود." },
              { icon: ShieldCheck, title: "پیگیری کامل", text: "هر تغییر وضعیت با زمان و دلیل در تاریخچه سفارش ثبت می‌شود." },
            ].map(({ icon: Icon, title, text }) => (
              <Card key={title}>
                <CardHeader><Icon className="size-5 text-primary" /><CardTitle className="text-base">{title}</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{text}</p></CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="smart">
          <Card>
            <CardHeader><CardTitle>نام برندتان را پیدا کنید</CardTitle><CardDescription>کسب‌وکار یا ایده را کوتاه توضیح دهید.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <Input value={suggestionPrompt} onChange={(event) => setSuggestionPrompt(event.target.value)} placeholder="مثلاً فروشگاه تخصصی ابزار طراحی" aria-label="توضیح کسب‌وکار" />
                <Button onClick={() => void generateSuggestions()} disabled={busy !== null || suggestionPrompt.trim().length < 2}>
                  {busy === "ai" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
                  ساخت پیشنهاد
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {suggestions.map((item) => (
                  <button key={item.domain} type="button" onClick={() => { setQuery(item.domain); void searchDomain(item.domain) }} className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 text-start transition-colors hover:bg-accent">
                    <span className="flex flex-col gap-1"><strong dir="ltr" className="text-left">{item.domain}</strong><small className="text-muted-foreground">{item.reason}</small></span>
                    <Search className="size-5 shrink-0" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="flex flex-col gap-3">
          {orders.length === 0 ? (
            <Card><CardHeader><CardTitle>هنوز سفارشی ندارید</CardTitle><CardDescription>پس از خرید، روند ثبت دامنه اینجا نمایش داده می‌شود.</CardDescription></CardHeader></Card>
          ) : orders.map((order) => <OrderCard key={order.id} order={order} />)}
        </TabsContent>
      </Tabs>
    </main>
  )
}

function AvailabilityCard({ lookup, busy, onPurchase }: { lookup: Lookup; busy: boolean; onPurchase: () => void }) {
  const meta = statusMeta[lookup.status] ?? statusMeta.UNKNOWN
  const Icon = meta.icon
  const available = lookup.status === "AVAILABLE"
  return (
    <Card className={available ? "border-primary/40" : undefined}>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-2"><CardTitle dir="ltr" className="text-left text-2xl">{lookup.unicodeDomain}</CardTitle><CardDescription>آخرین بررسی: {new Date(lookup.checkedAt).toLocaleTimeString("fa-IR")}</CardDescription></div>
        <Badge variant={available ? "default" : "secondary"}><Icon data-icon="inline-start" /> {meta.label}</Badge>
      </CardHeader>
      <CardContent>{available && lookup.priceIrt ? <p className="text-2xl font-bold">{money(lookup.priceIrt)}</p> : <p className="text-muted-foreground">برای انتخاب نام دیگر یا پیشنهاد هوشمند ادامه دهید.</p>}</CardContent>
      {available && <CardFooter><Button className="w-full md:w-auto" size="lg" onClick={onPurchase} disabled={busy}>{busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <WalletCards data-icon="inline-start" />} خرید و ثبت دامنه</Button></CardFooter>}
    </Card>
  )
}

function OrderCard({ order }: { order: DomainOrder }) {
  const meta = statusMeta[order.status] ?? statusMeta.UNKNOWN
  const Icon = meta.icon
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1"><CardTitle dir="ltr" className="text-left">{order.asciiDomain}</CardTitle><CardDescription>{order.publicId} · {new Date(order.createdAt).toLocaleDateString("fa-IR")}</CardDescription></div>
        <Badge variant="secondary"><Icon data-icon="inline-start" /> {meta.label}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">مبلغ</span><strong>{money(order.amountIrt)}</strong></div>
        {order.events.map((event) => <div key={event.id} className="flex items-start gap-3 border-r-2 border-primary/40 pr-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="flex flex-col gap-1 text-sm"><span>{event.message}</span><small className="text-muted-foreground">{new Date(event.createdAt).toLocaleString("fa-IR")}</small></span></div>)}
      </CardContent>
    </Card>
  )
}
