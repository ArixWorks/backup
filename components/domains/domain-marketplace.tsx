"use client"

import { useMemo, useState } from "react"
import { motion } from "motion/react"
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
import { LivingSurface } from "@/components/living-surface"
import { PremiumHeroCard } from "@/components/premium-hero-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  purchasedAt: string | null
  expiresAt: string | null
  ns1: string | null
  ns2: string | null
  ns3: string | null
  ns4: string | null
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
  PROCESSING: { label: "در حال خرید", icon: Loader2 },
  AWAITING_NAMESERVERS: { label: "منتظر NS شما", icon: Clock3 },
  AWAITING_NAMESERVER_SETUP: { label: "در انتظار ثبت NS", icon: Loader2 },
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
  const [unavailableDomain, setUnavailableDomain] = useState<string | null>(null)
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
      } else if (error instanceof ApiError && error.code === "DOMAIN_UNAVAILABLE") {
        setUnavailableDomain(lookup.asciiDomain)
        if (source === "smart") setSuggestions((current) => current.map((item) => item.asciiDomain === lookup.asciiDomain ? { ...item, status: "REGISTERED" } : item))
        else setLookups((current) => current.filter((item) => item.asciiDomain !== lookup.asciiDomain))
      } else if (error instanceof ApiError && ["CONFLICT", "VALIDATION", "VALIDATION_ERROR"].includes(error.code)) {
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 overflow-hidden px-4 py-8 md:px-6 md:py-14" dir="rtl">
      <motion.header initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }} className="relative flex flex-col gap-5 pb-2">
        <div aria-hidden className="pointer-events-none absolute -inset-x-20 -top-24 -z-10 h-64 opacity-50"><LivingSurface intensity="soft" lines={false} particles={false} blooms /></div>
        <Badge variant="secondary" className="w-fit border border-primary/20 bg-primary/5 px-3 py-1.5"><ShieldCheck data-icon="inline-start" /> ثبت امن و شفاف</Badge>
        <div className="flex max-w-4xl flex-col gap-4">
          <h1 className="text-balance text-4xl font-black leading-tight tracking-tight md:text-6xl">دامنه‌ای که <span className="text-primary">برندتان</span> با آن شروع می‌شود</h1>
          <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">استعلام لحظه‌ای، قیمت قطعی و پیگیری ثبت؛ بدون هزینه پنهان و با بررسی دوباره پیش از خرید.</p>
        </div>
      </motion.header>

      <Tabs defaultValue="search" className="flex flex-col gap-6">
        <TabsList className="h-auto w-full rounded-2xl border border-border/70 bg-card/80 p-1.5 shadow-xl shadow-background/40 backdrop-blur-xl md:w-fit">
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
            <Card><CardHeader><CardTitle>دامنه قابل ثبت پیدا نشد</CardTitle><CardDescription>این نام در میان پسوندهای فعال فروش��اه آزاد نیست. نام دیگری امتحان کنید یا از پیشنهاد هوشمند کمک بگیرید.</CardDescription></CardHeader></Card>
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

        <TabsContent value="smart" className="flex flex-col gap-6">
          <PremiumHeroCard intensity="normal" className="rounded-3xl !p-0" aria-label="پیشنهاد هوشمند دامنه">
            <div className="grid min-h-80 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="flex flex-col gap-7 p-5 sm:p-8 lg:p-10">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-lg shadow-primary/10"><Sparkles className="size-6" /></span>
                  <div className="flex flex-col gap-2"><h2 className="text-balance text-2xl font-bold md:text-3xl">نام برندتان را هوشمند پیدا کنید</h2><p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">ایده را بنویسید؛ نام‌های کوتاه و برندپذیر ساخته می‌شوند و همان لحظه امکان ثبت آن‌ها بررسی خواهد شد.</p></div>
                </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={suggestionPrompt}
                  onChange={(event) => setSuggestionPrompt(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) void generateSuggestions() }}
                  placeholder="مثلاً SubIO یا فروشگاه ابزار طراحی"
                  aria-label="توضیح کسب‌وکار"
                  className="h-14 rounded-2xl border-primary/20 bg-background/70 px-5 text-base shadow-inner backdrop-blur-md focus-visible:ring-primary/40"
                />
                <Button size="lg" className="h-14 shrink-0 rounded-2xl px-6 shadow-lg shadow-primary/15 transition-transform active:scale-95" onClick={() => void generateSuggestions()} disabled={busy !== null || suggestionPrompt.trim().length < 2}>
                  {busy === "ai" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
                  {busy === "ai" ? "ساخت و بررسی نام‌ها" : "ساخت پیشنهاد"}
                </Button>
              </div>

              {busy === "ai" && suggestions.length === 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="h-40 animate-pulse rounded-2xl border border-primary/10 bg-muted/30" />)}
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
                <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-primary/20 bg-background/30 p-5">
                  <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10"><ShieldCheck className="size-4 text-primary" /></span><div><p className="font-semibold">پیشنهاد، استعلام و خرید در یک مسیر</p><p className="text-sm leading-relaxed text-muted-foreground">نتیجه‌ها با قیمت قطعی و وضعیت ثبت نمایش داده می‌شوند.</p></div></div>
                </div>
              )}
              </div>
              <DomainOrbitScene />
            </div>
          </PremiumHeroCard>
        </TabsContent>

        <TabsContent value="orders" className="flex flex-col gap-3">
          {orders.length === 0 ? (
            <Card><CardHeader><CardTitle>هنوز سفارشی ندارید</CardTitle><CardDescription>پس از خرید، روند ثبت دامنه اینجا نمایش داده می‌شود.</CardDescription></CardHeader></Card>
          ) : orders.map((order) => <OrderCard key={order.id} order={order} onUpdated={() => mutateOrders()} />)}
        </TabsContent>
      </Tabs>

      <Dialog open={unavailableDomain !== null} onOpenChange={(open) => { if (!open) setUnavailableDomain(null) }}>
        <DialogContent size="sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="size-5 text-destructive" />دامنه دیگر آزاد نیست</DialogTitle>
            <DialogDescription>بررسی نهایی درست پیش از ثبت سفارش انجام شد.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <p className="leading-relaxed">متأسفانه دامنه <strong dir="ltr" className="inline-block">{unavailableDomain}</strong> در فاصله استعلام تا خرید توسط شخص دیگری ثبت شده و امکان ثبت آن وجود ندارد.</p>
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">هیچ سفارشی ثبت نشده و هیچ مبلغی از کیف پول شما فریز یا کسر نشده است.</p>
          </DialogBody>
          <DialogFooter><Button className="w-full sm:w-auto" onClick={() => setUnavailableDomain(null)}>متوجه شدم</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function DomainOrbitScene() {
  const labels = [".com", ".net", ".ir"]
  return (
    <div aria-hidden className="relative hidden min-h-80 overflow-hidden border-r border-primary/10 bg-primary/5 lg:flex lg:items-center lg:justify-center [perspective:900px]">
      <div className="absolute inset-0 opacity-60"><LivingSurface intensity="normal" lines={false} particles blooms /></div>
      <motion.div className="relative flex size-56 items-center justify-center [transform-style:preserve-3d]" animate={{ rotateY: 360 }} transition={{ duration: 24, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}>
        <motion.div className="absolute flex size-28 items-center justify-center rounded-full border border-primary/30 bg-background/70 shadow-2xl shadow-primary/20 backdrop-blur-xl" animate={{ rotateY: -360, y: [0, -7, 0] }} transition={{ rotateY: { duration: 24, repeat: Number.POSITIVE_INFINITY, ease: "linear" }, y: { duration: 4.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" } }}>
          <Globe2 className="size-12 text-primary" />
          <span className="absolute inset-2 rounded-full border border-dashed border-primary/20" />
        </motion.div>
        {labels.map((label, index) => {
          const angle = index * 120
          return <motion.span key={label} className="absolute flex h-10 min-w-16 items-center justify-center rounded-xl border border-primary/25 bg-card/90 px-3 font-mono text-sm font-bold text-primary shadow-xl backdrop-blur-md" style={{ transform: `rotateY(${angle}deg) translateZ(112px)` }} animate={{ y: [0, index % 2 === 0 ? -6 : 6, 0] }} transition={{ duration: 3.8 + index * 0.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}>{label}</motion.span>
        })}
      </motion.div>
      <div className="absolute bottom-7 flex flex-col items-center gap-1 text-center"><strong className="text-sm">از ایده تا دامنه آزاد</strong><span className="text-xs text-muted-foreground">کشف هوشمند، استعلام زنده، ثبت امن</span></div>
    </div>
  )
}

function SmartSuggestionCard({ item, busy, onPurchase }: { item: SmartSuggestion; busy: boolean; onPurchase: () => void }) {
  const available = item.status === "AVAILABLE"
  const taken = item.status === "REGISTERED" || item.status === "RESERVED" || item.status === "PREMIUM"
  const failed = item.status === "ERROR" || item.status === "LOOKUP_ERROR" || item.status === "UNKNOWN"
  return (
    <motion.div initial={{ opacity: 0, y: 18, rotateX: -4 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} whileHover={{ y: -4, scale: 1.01 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="[perspective:800px]">
    <Card className={`h-full overflow-hidden rounded-2xl shadow-lg transition-shadow ${available ? "border-chart-2/60 bg-chart-2/5 shadow-chart-2/5" : taken ? "border-destructive/40 bg-destructive/5 shadow-destructive/5" : "border-border bg-muted/20"}`}>
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
    </motion.div>
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

function OrderCard({ order, onUpdated }: { order: DomainOrder; onUpdated: () => Promise<unknown> }) {
  const meta = statusMeta[order.status] ?? statusMeta.UNKNOWN
  const Icon = meta.icon
  const [nameservers, setNameservers] = useState({ ns1: order.ns1 ?? "", ns2: order.ns2 ?? "", ns3: order.ns3 ?? "", ns4: order.ns4 ?? "" })
  const [submitting, setSubmitting] = useState(false)
  async function submitNameservers() {
    setSubmitting(true)
    try {
      await apiPost("/api/v1/domains/orders", { orderId: order.id, ...nameservers })
      toast.success("NSها ثبت شد و درخواست برای ادمین ارسال گردید.")
      await onUpdated()
    } catch (error) { toast.error(error instanceof Error ? error.message : "ثبت NS انجام نشد.") } finally { setSubmitting(false) }
  }
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border/60">
        <div className="flex flex-col gap-1"><CardTitle dir="ltr" className="text-left">{order.asciiDomain}</CardTitle><CardDescription>{order.publicId} · {new Date(order.createdAt).toLocaleDateString("fa-IR")}</CardDescription></div>
        <Badge variant="secondary"><Icon data-icon="inline-start" /> {meta.label}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">مبلغ</span><strong>{money(order.amountIrt)}</strong>{order.purchasedAt && <span>خرید: <strong>{new Date(order.purchasedAt).toLocaleDateString("fa-IR")}</strong></span>}{order.expiresAt && <span>انقضا: <strong>{new Date(order.expiresAt).toLocaleDateString("fa-IR")}</strong></span>}</div>
        {order.status === "AWAITING_NAMESERVERS" && <section className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-4" aria-label="ثبت نیم سرورها"><div><h3 className="font-bold">NSهای دامنه را ثبت کنید</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">NS1 و NS2 الزامی هستند. می‌توانید این مرحله را اکنون یا هر زمان دیگری تکمیل کنید.</p></div><div className="grid gap-3 sm:grid-cols-2">{(["ns1", "ns2", "ns3", "ns4"] as const).map((key, index) => <label key={key} className="flex flex-col gap-2 text-sm font-medium">NS{index + 1}{index < 2 && <span className="text-destructive">الزامی</span>}<Input dir="ltr" className="text-left" autoCapitalize="none" autoCorrect="off" placeholder={`ns${index + 1}.example.com`} value={nameservers[key]} onChange={(event) => setNameservers((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div><Button className="w-full sm:w-fit" onClick={() => void submitNameservers()} disabled={submitting || !nameservers.ns1.trim() || !nameservers.ns2.trim()}>{submitting ? <Loader2 className="animate-spin" /> : <Globe2 />}ثبت NS و ارسال برای ادمین</Button></section>}
        {order.status === "AWAITING_NAMESERVER_SETUP" && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><strong>NSها برای ادمین ارسال شده‌اند</strong><div dir="ltr" className="mt-3 grid gap-2 text-left font-mono text-sm sm:grid-cols-2">{[order.ns1, order.ns2, order.ns3, order.ns4].filter(Boolean).map((ns) => <span key={ns!} className="rounded-lg bg-background/70 p-2">{ns}</span>)}</div></div>}
        <div className="flex flex-col gap-3">{order.events.map((event) => <div key={event.id} className="flex items-start gap-3 border-r-2 border-primary/40 pr-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="flex flex-col gap-1 text-sm"><span>{event.message}</span><small className="text-muted-foreground">{new Date(event.createdAt).toLocaleString("fa-IR")}</small></span></div>)}</div>
      </CardContent>
    </Card>
  )
}
