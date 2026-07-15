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
import { ApiError, apiGet, apiPost } from "@/lib/api-client"
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
  status: "AVAILABLE" | "REGISTERED" | "UNSUPPORTED" | "UNKNOWN" | "LOOKUP_ERROR" | "ERROR" | "PREMIUM" | "RESERVED"
  priceIrt: string | null
  checkedAt: string
}
interface SmartSuggestion extends Lookup { domain: string; reason: string }
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
  LOOKUP_ERROR: { label: "بررسی ناموفق", icon: Clock3 },
  ERROR: { label: "بررسی ناموفق", icon: Clock3 },
  PREMIUM: { label: "ویژه و غیرقابل فروش", icon: XCircle },
  RESERVED: { label: "رزرو شده", icon: XCircle },
  PENDING_PURCHASE: { label: "در صف ثبت", icon: Clock3 },
  PROCESSING: { label: "در حال ثبت", icon: Loader2 },
  COMPLETED: { label: "تکمیل شده", icon: CheckCircle2 },
  FAILED: { label: "ناموفق؛ بازپرداخت شد", icon: XCircle },
  EXPIRED: { label: "منقضی؛ بازپرداخت شد", icon: XCircle },
}

export function DomainMarketplace() {
  const [query, setQuery] = useState("")
  const [lookups, setLookups] = useState<Lookup[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"lookup" | "quote" | "ai" | null>(null)
  const [suggestionPrompt, setSuggestionPrompt] = useState("")
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([])
  const [purchasingDomain, setPurchasingDomain] = useState<string | null>(null)
  const { data: tldResponse } = useSWR<{ data: { tlds: Tld[] } }>("/api/v1/domains/tlds", apiGet)
  const { data: ordersResponse, mutate: mutateOrders } = useSWR<{ data: { orders: DomainOrder[]; domains: unknown[] } }>(
    "/api/v1/domains/orders",
    apiGet,
  )
  const tlds = tldResponse?.data.tlds ?? []
  const orders = ordersResponse?.data.orders ?? []

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query])

  async function searchDomain(domain = normalizedQuery) {
    if (!domain) {
      setSearchError("نام موردنظر را وارد کنید؛ برای نمونه arix یا arix.com")
      return
    }
    setSearchError(null)
    setLookups([])
    setHasSearched(false)
    setBusy("lookup")
    try {
      const result = unwrap<{ exact: boolean; results: Lookup[] }>(await apiPost("/api/v1/domains/lookup", { domain }))
      setLookups(result.results)
      setHasSearched(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "استعلام دامنه انجام نشد."
      setSearchError(message)
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  async function purchase(lookup: Lookup, source: "search" | "smart" = "search") {
    setPurchasingDomain(lookup.asciiDomain)
    setBusy("quote")
    try {
      const quote = unwrap<{ id: string }>(await apiPost("/api/v1/domains/quote", { domain: lookup.asciiDomain }))
      const idempotencyKey = crypto.randomUUID()
      await apiPost("/api/v1/domains/purchase", { quoteId: quote.id, idempotencyKey })
      toast.success("سفارش ثبت شد؛ وضعیت آن را از بخش سفارش‌ها دنبال کنید.")
      if (source === "search") {
        setLookups([])
        setHasSearched(false)
      } else {
        setSuggestions((current) => current.map((item) => item.asciiDomain === lookup.asciiDomain ? { ...item, status: "REGISTERED" } : item))
      }
      await mutateOrders()
    } catch (error) {
      if (error instanceof ApiError && error.code === "INSUFFICIENT_FUNDS") {
        toast.error("موجودی کیف پول برای ثبت این دامنه کافی نیست.", { action: { label: "افزایش موجودی", onClick: () => { window.location.href = "/wallet" } } })
      } else if (error instanceof ApiError && ["CONFLICT", "VALIDATION_ERROR"].includes(error.code)) {
        toast.error("وضعیت یا قیمت دامنه تغییر کرده است؛ دوباره استعلام بگیرید.")
        if (source === "smart") await generateSuggestions()
        else await searchDomain(lookup.asciiDomain)
      } else {
        toast.error(error instanceof Error ? error.message : "ثبت سفارش انجام نشد؛ وجهی کسر نشده است.")
      }
    } finally {
      setBusy(null)
      setPurchasingDomain(null)
    }
  }

  async function generateSuggestions() {
    if (suggestionPrompt.trim().length < 2) return
    setSuggestions([])
    setBusy("ai")
    try {
      const result = unwrap<{ suggestions: SmartSuggestion[] }>(
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
                onChange={(event) => { setQuery(event.target.value); if (searchError) setSearchError(null) }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) void searchDomain()
                }}
                placeholder="example.ir"
                aria-label="نام دامنه"
                aria-invalid={Boolean(searchError)}
                aria-describedby={searchError ? "domain-search-error" : undefined}
                className="h-12 text-left"
              />
              <Button size="lg" onClick={() => void searchDomain()} disabled={busy !== null}>
                {busy === "lookup" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Search data-icon="inline-start" />}
                استعلام دامنه
              </Button>
            </CardContent>
            {searchError && <p id="domain-search-error" role="alert" className="px-6 text-sm text-destructive">{searchError}</p>}
            <CardFooter className="flex flex-wrap gap-2">
              {tlds.slice(0, 12).map((item) => (
                <Button key={item.id} variant="outline" size="sm" onClick={() => setQuery(`${query.split(".")[0]}${item.tld}`)}>
                  <span dir="ltr">{item.tld}</span>
                  <span className="text-muted-foreground">{money(item.basePriceIrt)}</span>
                </Button>
              ))}
              {tlds.length > 12 && <Badge variant="secondary">+{(tlds.length - 12).toLocaleString("fa-IR")} پسوند دیگر در جست‌وجوی کامل</Badge>}
            </CardFooter>
          </Card>

          {lookups.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {lookups.map((lookup) => (
                <AvailabilityCard key={lookup.asciiDomain} lookup={lookup} busy={busy === "quote"} onPurchase={() => void purchase(lookup)} />
              ))}
            </div>
          ) : hasSearched && busy !== "lookup" ? (
            <Card><CardHeader><CardTitle>دامنه قابل ثبت پیدا نشد</CardTitle><CardDescription>این نام در میان پسوندهای فعال فروشگاه آزاد نیست. نام دیگری امتحان کنید یا از پیشنهاد هوشمند کمک بگیرید.</CardDescription></CardHeader></Card>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: Globe2, title: "استعلام زنده", text: "وضعیت هر دامنه پیش از نمایش قیمت و دوباره پیش از ثبت سفارش بررسی می‌شود." },
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

        <TabsContent value="smart" className="flex flex-col gap-5">
          <Card className="overflow-hidden border-primary/30">
            <CardHeader className="border-b bg-primary/5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-5" /></span>
                <div className="flex flex-col gap-1"><CardTitle>نام برندتان را هوشمند پیدا کنید</CardTitle><CardDescription>ایده را بنویسید؛ نام‌ها ساخته و همان لحظه از نظر امکان ثبت بررسی می‌شوند.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={suggestionPrompt}
                  onChange={(event) => setSuggestionPrompt(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) void generateSuggestions() }}
                  placeholder="مثلاً SubIO یا فروشگاه ابزار طراحی"
                  aria-label="توضیح کسب‌وکار"
                  className="h-12"
                />
                <Button size="lg" className="shrink-0" onClick={() => void generateSuggestions()} disabled={busy !== null || suggestionPrompt.trim().length < 2}>
                  {busy === "ai" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
                  {busy === "ai" ? "ساخت و بررسی نام‌ها" : "ساخت پیشنهاد"}
                </Button>
              </div>

              {busy === "ai" && suggestions.length === 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-xl border bg-muted/40" />)}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div><h2 className="font-semibold">نتیجه پیشنهاد و استعلام</h2><p className="text-sm text-muted-foreground">دامنه‌های آزاد ابتدا نمایش داده شده‌اند.</p></div>
                    <div className="flex flex-wrap gap-2"><Badge className="bg-chart-2 text-background">{suggestions.filter((item) => item.status === "AVAILABLE").length.toLocaleString("fa-IR")} آزاد</Badge><Badge variant="destructive">{suggestions.filter((item) => item.status === "REGISTERED").length.toLocaleString("fa-IR")} گرفته‌شده</Badge></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {suggestions.map((item) => <SmartSuggestionCard key={item.domain} item={item} busy={purchasingDomain === item.asciiDomain} onPurchase={() => void purchase(item, "smart")} />)}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                  <Globe2 className="size-8 text-primary" /><p className="font-semibold">ایده شما به دامنه قابل ثبت تبدیل می‌شود</p><p className="max-w-md text-sm leading-relaxed text-muted-foreground">چند نام کوتاه و برندپذیر همراه با وضعیت ثبت و قیمت قطعی نمایش داده می‌شود.</p>
                </div>
              )}
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

function SmartSuggestionCard({ item, busy, onPurchase }: { item: SmartSuggestion; busy: boolean; onPurchase: () => void }) {
  const available = item.status === "AVAILABLE"
  const taken = item.status === "REGISTERED" || item.status === "RESERVED" || item.status === "PREMIUM"
  const failed = item.status === "ERROR" || item.status === "LOOKUP_ERROR" || item.status === "UNKNOWN"
  return (
    <Card className={available ? "border-chart-2/60 bg-chart-2/5" : taken ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/20"}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1"><CardTitle dir="ltr" className="truncate text-left text-xl">{item.domain}</CardTitle><CardDescription className="line-clamp-2 leading-relaxed">{item.reason}</CardDescription></div>
        <Badge className={available ? "shrink-0 bg-chart-2 text-background" : taken ? "shrink-0 bg-destructive text-destructive-foreground" : "shrink-0"} variant={failed ? "secondary" : "default"}>
          {available ? <CheckCircle2 data-icon="inline-start" /> : failed ? <Clock3 data-icon="inline-start" /> : <XCircle data-icon="inline-start" />}
          {available ? "آزاد" : failed ? "نیازمند بررسی" : "گرفته شده"}
        </Badge>
      </CardHeader>
      <CardContent className="flex min-h-12 items-end">
        {available && item.priceIrt ? <div className="flex items-baseline gap-2"><strong className="text-2xl">{money(item.priceIrt)}</strong><span className="text-xs text-muted-foreground">ثبت یک‌ساله</span></div> : <p className="text-sm text-muted-foreground">{failed ? "در حال حاضر نتیجه قطعی دریافت نشد؛ دوباره پیشنهادها را بررسی کنید." : "این نام قبلاً ثبت یا رزرو شده است."}</p>}
      </CardContent>
      <CardFooter>
        {available ? <Button className="w-full" size="lg" onClick={onPurchase} disabled={busy}>{busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <WalletCards data-icon="inline-start" />}{busy ? "در حال ثبت سفارش" : "خرید و ثبت همین دامنه"}</Button> : <Button className="w-full" variant="outline" disabled>{taken ? "امکان خرید ندارد" : "وضعیت نامشخص"}</Button>}
      </CardFooter>
    </Card>
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
