"use client"

import { useMemo, useState } from "react"
import { motion } from "motion/react"
import useSWR from "swr"
import { Globe2, Loader2, Search, Sparkles, XCircle } from "lucide-react"
import { toast } from "sonner"
import { ApiError, apiGet, apiPost } from "@/lib/api-client"
import { LivingSurface } from "@/components/living-surface"
import { PremiumHeroCard } from "@/components/premium-hero-card"
import { DomainResultsCarousel, type DomainResult, type DomainAvailability } from "@/components/domains/domain-results-carousel"
import { DomainPurchaseDialog } from "@/components/domains/domain-purchase-dialog"
import { CelebrationOverlay } from "@/components/celebration-overlay"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/components/i18n-provider"
import { DOMAIN_COPY } from "@/lib/i18n/domain-copy"

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

const unwrap = <T,>(response: { data: T }) => response.data

/** Collapse the granular lookup status into the carousel's 3 visual buckets. */
function toAvailability(status: Lookup["status"]): DomainAvailability {
  if (status === "AVAILABLE") return "available"
  if (status === "REGISTERED" || status === "RESERVED" || status === "PREMIUM") return "taken"
  return "review"
}

export function DomainMarketplace() {
  const { locale, price, dir } = useI18n()
  const copy = DOMAIN_COPY[locale]
  const money = (value: string | number) => price(Number(value))
  const [query, setQuery] = useState("")
  const [lookups, setLookups] = useState<Lookup[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [busy, setBusy] = useState<"lookup" | "quote" | "ai" | null>(null)
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([])
  const [purchasingDomain, setPurchasingDomain] = useState<string | null>(null)
  const [unavailableDomain, setUnavailableDomain] = useState<string | null>(null)
  // The domain awaiting checkout confirmation, opening the purchase popup.
  const [purchaseTarget, setPurchaseTarget] = useState<{ item: DomainResult; source: "search" | "smart" } | null>(null)
  // Successful-purchase celebration overlay (same as the store flow), with a
  // deep link to the newly created domain order detail page.
  const [celebration, setCelebration] = useState<{ subject: string; href: string } | null>(null)
  const { data: tldResponse } = useSWR<{ data: { tlds: Tld[] } }>("/api/v1/domains/tlds", apiGet)
  const tlds = tldResponse?.data.tlds ?? []

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query])

  // Normalized, presentation-ready results for the swipeable carousels.
  // Order is preserved from the API so available/taken domains stay interleaved.
  const describe = (availability: DomainAvailability) =>
    availability === "available" ? copy.descAvailable : availability === "taken" ? copy.descTaken : copy.descReview
  const lookupResults = useMemo<DomainResult[]>(
    () =>
      lookups.map((lookup) => {
        const availability = toAvailability(lookup.status)
        return { key: lookup.asciiDomain, ascii: lookup.asciiDomain, display: lookup.unicodeDomain, tld: lookup.tld, availability, price: lookup.priceIrt, description: describe(availability) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookups, locale],
  )
  const suggestionResults = useMemo<DomainResult[]>(
    () =>
      suggestions.map((item) => {
        const availability = toAvailability(item.status)
        return { key: item.asciiDomain, ascii: item.asciiDomain, display: item.domain, tld: item.tld, availability, price: item.priceIrt, description: item.reason || describe(availability) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions, locale],
  )
  // Clicking "buy" no longer registers immediately: it opens the confirmation
  // popup (domain summary + payment-method picker), matching the store flow.
  const handleLookupPurchase = (item: DomainResult) => setPurchaseTarget({ item, source: "search" })
  const handleSuggestionPurchase = (item: DomainResult) => setPurchaseTarget({ item, source: "smart" })

  // Invoked when the user confirms wallet payment inside the popup.
  const handleConfirmWallet = () => {
    const target = purchaseTarget
    if (!target) return
    const original =
      target.source === "search"
        ? lookups.find((entry) => entry.asciiDomain === target.item.ascii)
        : suggestions.find((entry) => entry.asciiDomain === target.item.ascii)
    if (original) void purchase(original, target.source)
  }

  async function searchDomain(domain = normalizedQuery) {
    if (!domain) {
      setSearchError(copy.queryRequired)
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
      const message = error instanceof Error ? error.message : copy.lookupFailed
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
      const order = unwrap<{ publicId: string }>(await apiPost("/api/v1/domains/purchase", { quoteId: quote.id, idempotencyKey }))
      setPurchaseTarget(null)
      setCelebration({ subject: lookup.unicodeDomain, href: `/orders/domain/${order.publicId}` })
      if (source === "search") {
        setLookups([])
        setHasSearched(false)
      } else {
        setSuggestions((current) => current.map((item) => item.asciiDomain === lookup.asciiDomain ? { ...item, status: "REGISTERED" } : item))
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "INSUFFICIENT_FUNDS") {
        toast.error(copy.insufficient, { action: { label: copy.addFunds, onClick: () => { window.location.href = "/wallet" } } })
      } else if (error instanceof ApiError && error.code === "DOMAIN_UNAVAILABLE") {
        setPurchaseTarget(null)
        setUnavailableDomain(lookup.asciiDomain)
        if (source === "smart") setSuggestions((current) => current.map((item) => item.asciiDomain === lookup.asciiDomain ? { ...item, status: "REGISTERED" } : item))
        else setLookups((current) => current.filter((item) => item.asciiDomain !== lookup.asciiDomain))
      } else if (error instanceof ApiError && ["CONFLICT", "VALIDATION", "VALIDATION_ERROR"].includes(error.code)) {
        toast.error(copy.changed)
        if (source === "smart") await generateSuggestions()
        else await searchDomain(lookup.asciiDomain)
      } else {
        toast.error(error instanceof Error ? error.message : copy.orderFailed)
      }
    } finally {
      setBusy(null)
      setPurchasingDomain(null)
    }
  }

  async function generateSuggestions(prompt = normalizedQuery) {
    if (prompt.length < 2) {
      setSearchError(copy.ideaRequired)
      return
    }
    setSearchError(null)
    setLookups([])
    setHasSearched(false)
    setSuggestions([])
    setBusy("ai")
    try {
      const result = unwrap<{ suggestions: SmartSuggestion[] }>(
        await apiPost("/api/v1/domains/suggestions", { prompt }),
      )
      setSuggestions(result.suggestions)
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.suggestionsFailed
      setSearchError(message)
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  async function discoverDomain() {
    if (!normalizedQuery) {
      setSearchError(copy.ideaRequired)
      return
    }
    setSuggestions([])
    if (/^[^\s.]+(?:\.[^\s.]+)+$/u.test(normalizedQuery)) await searchDomain(normalizedQuery)
    else await generateSuggestions(normalizedQuery)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 overflow-hidden px-4 py-8 md:px-6 md:py-14" dir={dir}>
      <div className="flex flex-col gap-6">
          <PremiumHeroCard intensity="normal" pointerMotion={false} className="overflow-hidden rounded-3xl !p-0 [transform:translateZ(0)]" aria-label={copy.discoverTab}>
            <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
              <div className="flex flex-col gap-6 p-5 sm:p-8 lg:p-10">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-lg shadow-primary/10"><Sparkles className="size-6" /></span>
                  <div className="flex flex-col gap-2"><h2 className="text-balance text-2xl font-bold md:text-3xl">{copy.smartTitle}</h2><p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">{copy.smartDescription}</p></div>
                </div>
                <DomainOrbitScene compact title={copy.orbitTitle} subtitle={copy.orbitSubtitle} />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input dir="ltr" value={query} onChange={(event) => { setQuery(event.target.value); if (searchError) setSearchError(null) }} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) void discoverDomain() }} placeholder={copy.placeholder} aria-label={copy.inputLabel} aria-invalid={Boolean(searchError)} aria-describedby={searchError ? "domain-search-error" : "domain-search-hint"} className="h-14 rounded-2xl border-primary/20 bg-background/70 px-5 text-left text-base shadow-inner backdrop-blur-md focus-visible:ring-primary/40" />
                  <Button size="lg" className="h-14 shrink-0 rounded-2xl px-6 shadow-lg shadow-primary/15 transition-transform active:scale-95" onClick={() => void discoverDomain()} disabled={busy !== null}>
                    {busy === "lookup" || busy === "ai" ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Search data-icon="inline-start" />}
                    {busy === "lookup" ? copy.searching : busy === "ai" ? copy.generating : copy.discover}
                  </Button>
                </div>
                <p id="domain-search-hint" className="text-xs leading-relaxed text-muted-foreground">{copy.hint}</p>
                {searchError && <p id="domain-search-error" role="alert" className="text-sm text-destructive">{searchError}</p>}
                <div className="flex flex-wrap gap-2">{tlds.filter((item) => [".com", ".net", ".org", ".shop"].includes(item.tld)).map((item) => <Button key={item.id} variant="outline" size="sm" onClick={() => setQuery(`${query.split(".")[0]}${item.tld}`)}><span dir="ltr">{item.tld}</span><span className="text-muted-foreground">{money(item.basePriceIrt)}</span></Button>)}</div>
              </div>
              <DomainOrbitScene title={copy.orbitTitle} subtitle={copy.orbitSubtitle} />
            </div>
          </PremiumHeroCard>

          {busy === "ai" && suggestions.length === 0 ? (
            <section className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-1 text-center">
                <h2 className="text-balance text-xl font-bold">{copy.suggestionsTitle}</h2>
                <p className="text-pretty text-sm text-muted-foreground">{copy.generating}</p>
              </div>
              <DomainResultsCarousel loading loadingCount={7} items={[]} copy={copy} money={money} onPurchase={() => {}} purchasingKey={null} disabled />
            </section>
          ) : null}
          {lookupResults.length > 0 && (
            <section aria-label={copy.resultsTitle} className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-1 text-center">
                <h2 className="text-balance text-xl font-bold">{copy.resultsTitle}</h2>
                <p className="text-pretty text-sm text-muted-foreground">{copy.resultsHint}</p>
              </div>
              <DomainResultsCarousel items={lookupResults} copy={copy} money={money} onPurchase={handleLookupPurchase} purchasingKey={purchasingDomain} disabled={busy === "quote"} />
            </section>
          )}
          {hasSearched && lookups.length === 0 && busy !== "lookup" && <Card><CardHeader><CardTitle>{copy.noResult}</CardTitle><CardDescription>{copy.noResultDescription}</CardDescription></CardHeader></Card>}
          {suggestionResults.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <h2 className="text-balance text-xl font-bold">{copy.suggestionsTitle}</h2>
                <p className="text-pretty text-sm text-muted-foreground">{copy.suggestionsDescription}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Badge className="bg-chart-2 text-background">{suggestions.filter((item) => item.status === "AVAILABLE").length.toLocaleString(locale)} {copy.available}</Badge>
                  <Badge variant="destructive">{suggestions.filter((item) => item.status === "REGISTERED").length.toLocaleString(locale)} {copy.taken}</Badge>
                </div>
              </div>
              <DomainResultsCarousel items={suggestionResults} copy={copy} money={money} onPurchase={handleSuggestionPurchase} purchasingKey={purchasingDomain} disabled={busy === "quote"} />
            </section>
          )}
      </div>

      <DomainPurchaseDialog
        domain={purchaseTarget?.item ?? null}
        open={purchaseTarget !== null}
        onOpenChange={(open) => { if (!open && busy !== "quote") setPurchaseTarget(null) }}
        copy={copy}
        money={money}
        purchasing={busy === "quote"}
        onPayWallet={handleConfirmWallet}
      />

      <CelebrationOverlay
        open={celebration !== null}
        kind="domain-purchase"
        subject={celebration?.subject}
        actionHref={celebration?.href}
        onClose={() => setCelebration(null)}
      />

      <Dialog open={unavailableDomain !== null} onOpenChange={(open) => { if (!open) setUnavailableDomain(null) }}>
        <DialogContent size="sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="size-5 text-destructive" />{copy.unavailable}</DialogTitle>
            <DialogDescription>{copy.unavailableDescription}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <p className="leading-relaxed"><strong dir="ltr" className="inline-block">{unavailableDomain}</strong> — {copy.unavailableBody}</p>
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">{copy.noCharge}</p>
          </DialogBody>
          <DialogFooter><Button className="w-full sm:w-auto" onClick={() => setUnavailableDomain(null)}>{copy.understood}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function DomainOrbitScene({ compact = false, title, subtitle }: { compact?: boolean; title: string; subtitle: string }) {
  const labels = [".com", ".net", ".org"]
  return (
    <div aria-hidden className={compact ? "relative flex min-h-56 items-center justify-center overflow-hidden rounded-3xl border border-primary/15 bg-primary/5 lg:hidden" : "relative hidden min-h-80 overflow-hidden border-r border-primary/10 bg-primary/5 lg:flex lg:items-center lg:justify-center"}>
      <div className="absolute inset-0 opacity-60"><LivingSurface intensity="normal" lines={false} particles blooms /></div>
      <div className={compact ? "relative mb-8 flex size-44 items-center justify-center" : "relative flex size-60 items-center justify-center"}>
        <motion.div className="absolute inset-3 rounded-full border border-dashed border-primary/20 motion-reduce:transform-none" animate={{ rotate: 360 }} transition={{ duration: 32, repeat: Number.POSITIVE_INFINITY, ease: "linear" }} />
        <motion.div className={compact ? "relative z-10 flex size-20 items-center justify-center rounded-full border border-primary/30 bg-background/90 shadow-2xl shadow-primary/20 backdrop-blur-xl" : "relative z-10 flex size-28 items-center justify-center rounded-full border border-primary/30 bg-background/90 shadow-2xl shadow-primary/20 backdrop-blur-xl"} animate={{ y: [0, -5, 0] }} transition={{ duration: 4.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}>
          <Globe2 className={compact ? "size-9 text-primary" : "size-12 text-primary"} />
          <span className="absolute inset-2 rounded-full border border-dashed border-primary/20" />
        </motion.div>
        {labels.map((label, index) => {
          const angle = (index * 120 - 90) * (Math.PI / 180)
          const radius = compact ? 72 : 102
          return <motion.span key={label} className={compact ? "absolute z-20 flex h-8 min-w-14 items-center justify-center rounded-xl border border-primary/25 bg-card px-2 font-mono text-xs font-bold text-primary shadow-xl" : "absolute z-20 flex h-10 min-w-16 items-center justify-center rounded-xl border border-primary/25 bg-card px-3 font-mono text-sm font-bold text-primary shadow-xl"} style={{ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }} animate={{ y: [Math.sin(angle) * radius, Math.sin(angle) * radius - 4, Math.sin(angle) * radius] }} transition={{ duration: 3.8 + index * 0.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}>{label}</motion.span>
        })}
      </div>
      <div className={compact ? "absolute bottom-4 z-20 flex flex-col items-center gap-1 text-center" : "absolute bottom-7 z-20 flex flex-col items-center gap-1 text-center"}><strong className="text-sm">{title}</strong><span className="text-xs text-muted-foreground">{subtitle}</span></div>
    </div>
  )
}

