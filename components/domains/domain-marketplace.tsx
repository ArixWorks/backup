"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Headphones, ShieldCheck, Sparkles, XCircle, Zap } from "lucide-react"
import { toast } from "sonner"
import { ApiError, apiGet, apiPost } from "@/lib/api-client"
import { PremiumHeroCard } from "@/components/premium-hero-card"
import { DomainResultsCarousel, type DomainResult, type DomainAvailability } from "@/components/domains/domain-results-carousel"
import { DomainPurchaseDialog } from "@/components/domains/domain-purchase-dialog"
import { GlobeStage } from "@/components/domains/hero/globe-stage"
import { TldPicker } from "@/components/domains/hero/tld-picker"
import { DomainSearchField } from "@/components/domains/hero/domain-search-field"
import { CelebrationOverlay } from "@/components/celebration-overlay"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/components/i18n-provider"
import { DOMAIN_COPY } from "@/lib/i18n/domain-copy"

interface Tld { id: string; tld: string; title: string; basePriceIrt: string; supported: boolean }
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
  const { locale, price, num, dir } = useI18n()
  const copy = DOMAIN_COPY[locale]
  const money = (value: string | number) => price(Number(value))
  const [query, setQuery] = useState("")
  const [lookups, setLookups] = useState<Lookup[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  // Verdict for an exact lookup that returned nothing to buy, pinned to the domain
  // it belongs to so an edit in the search box clears it instead of leaving a stale
  // "already registered" label attached to a different name.
  const [exactVerdict, setExactVerdict] = useState<{ domain: string; verdict: "taken" | "unclear" } | null>(null)
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

  // Only extensions that are both active and marked as sellable count as supported.
  const sellableTlds = useMemo(() => tlds.filter((item) => item.supported), [tlds])
  // Stable identity for the globe hero: this component re-renders on every
  // search-box keystroke, and an inline .slice().map() would hand the globe a
  // brand-new array each time.
  const heroTlds = useMemo(() => sellableTlds.slice(0, 5).map((item) => item.tld), [sellableTlds])

  // Live, pre-search validation of the extension the user typed. We only judge
  // once the query looks like a full "label.ext" domain; bare keywords stay neutral.
  const isFullDomain = useMemo(() => /^[^\s.]+(?:\.[^\s.]+)+$/u.test(normalizedQuery), [normalizedQuery])
  const typedExtension = useMemo(() => {
    const match = normalizedQuery.match(/\.([a-z0-9-]+)$/)
    return match ? `.${match[1]}` : null
  }, [normalizedQuery])
  const matchedTld = useMemo(
    () => (typedExtension ? sellableTlds.find((item) => item.tld === typedExtension) ?? null : null),
    [typedExtension, sellableTlds],
  )
  const extState: "none" | "supported" | "unsupported" =
    !isFullDomain || !typedExtension || sellableTlds.length === 0 ? "none" : matchedTld ? "supported" : "unsupported"

  // The verdict only applies while the box still holds the domain it was measured
  // for, so typing a new name immediately drops the field back to its price state.
  const activeVerdict = exactVerdict?.domain === normalizedQuery ? exactVerdict.verdict : null

  // Prefill the box when the user picked an extension on the /domains/tlds page.
  useEffect(() => {
    const ext = new URLSearchParams(window.location.search).get("ext")
    if (ext && /^\.[a-z0-9-]{2,}$/i.test(ext)) {
      setQuery(ext.toLowerCase())
      requestAnimationFrame(() => {
        const el = document.getElementById("domain-search-input") as HTMLInputElement | null
        if (el) { el.focus(); el.setSelectionRange(0, 0) }
      })
    }
  }, [])

  /**
   * Swap the extension on whatever the user has typed. Picking a badge or chip
   * keeps their label and only replaces the suffix; with an empty box we just
   * seed the extension and park the caret in front of it so they can type.
   */
  function applyExtension(tld: string) {
    const label = query.trim().toLowerCase().split(".")[0]
    setQuery(`${label}${tld}`)
    setSearchError(null)
    requestAnimationFrame(() => {
      const el = document.getElementById("domain-search-input") as HTMLInputElement | null
      if (!el) return
      el.focus()
      const caret = label.length
      el.setSelectionRange(caret, caret)
    })
  }

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
    setExactVerdict(null)
    setBusy("lookup")
    try {
      const result = unwrap<{ exact: boolean; status: Lookup["status"] | null; results: Lookup[] }>(
        await apiPost("/api/v1/domains/lookup", { domain }),
      )
      setLookups(result.results)
      setHasSearched(true)
      // An exact search with no buyable result is answered in the search box itself.
      // "Registered/reserved/premium" is a definitive no; anything else (an unknown
      // or failed provider check) is only inconclusive, so the two are kept distinct.
      if (result.exact && result.results.length === 0) {
        const taken = result.status === "REGISTERED" || result.status === "RESERVED" || result.status === "PREMIUM"
        setExactVerdict({ domain, verdict: taken ? "taken" : "unclear" })
      }
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
        else {
          setLookups((current) => current.filter((item) => item.asciiDomain !== lookup.asciiDomain))
          // Someone took it between the check and checkout. Mark it so the field
          // reflects the new reality instead of still advertising its price.
          setExactVerdict({ domain: lookup.asciiDomain, verdict: "taken" })
        }
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
    setExactVerdict(null)
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
    if (extState === "unsupported") {
      setSearchError(copy.extUnsupported)
      return
    }
    setSuggestions([])
    if (isFullDomain) await searchDomain(normalizedQuery)
    else await generateSuggestions(normalizedQuery)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 overflow-hidden px-4 py-8 md:px-6 md:py-14" dir={dir}>
      <div className="flex flex-col gap-6">
          <PremiumHeroCard intensity="normal" pointerMotion={false} className="overflow-hidden rounded-3xl !p-0 [transform:translateZ(0)]" aria-label={copy.discoverTab}>
            <div className="grid items-center gap-8 p-5 sm:p-8 lg:grid-cols-2 lg:gap-10 lg:p-12">
              {/* In RTL this column renders on the right, mirroring the design. */}
              <div className="order-2 flex flex-col gap-6 lg:order-1">
                <div className="flex flex-col items-center gap-3 text-center">
                  {/* Title is flanked by a matching icon on both sides and kept to a
                      single line: `nowrap` + a smaller step below `sm` stops the
                      Persian copy breaking across two lines on narrow phones.
                      From `lg` the hero splits into two columns and the text column
                      is narrower than the nowrap width, so wrapping is re-enabled
                      there - otherwise the card's overflow-hidden clipped the end
                      of the title instead of pushing the page wider. */}
                  <h2 className="flex flex-nowrap items-center justify-center gap-x-1.5 whitespace-nowrap text-lg font-black leading-tight sm:gap-x-2 sm:text-2xl md:text-4xl lg:flex-wrap lg:whitespace-normal lg:text-2xl xl:text-3xl 2xl:text-4xl">
                    <Sparkles className="size-5 shrink-0 text-primary md:size-7" aria-hidden />
                    <span>{copy.heroTitleBefore}</span>
                    <span className="text-primary">{copy.heroTitleAccent}</span>
                    <span>{copy.heroTitleAfter}</span>
                    <Sparkles className="size-5 shrink-0 text-primary md:size-7" aria-hidden />
                  </h2>
                  <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">{copy.heroSubtitle}</p>
                </div>

                <DomainSearchField
                  value={query}
                  onChange={(next) => { setQuery(next); if (searchError) setSearchError(null) }}
                  onSubmit={() => void discoverDomain()}
                  extState={extState}
                  priceLabel={matchedTld ? money(matchedTld.basePriceIrt) : null}
                  domain={normalizedQuery}
                  busy={busy === "lookup" || busy === "ai"}
                  verdict={activeVerdict}
                  describedBy={extState === "unsupported" || searchError ? "domain-search-error" : "domain-search-hint"}
                  labels={{
                    placeholder: copy.heroPlaceholder,
                    aria: copy.inputLabel,
                    search: busy === "lookup" ? copy.searching : busy === "ai" ? copy.generating : copy.heroSearch,
                    checkingPrice: copy.priceChecking,
                    unsupported: copy.extUnsupported,
                    taken: copy.alreadyTaken,
                    unclear: copy.lookupUnclear,
                  }}
                />

                {extState === "unsupported" ? (
                  <p id="domain-search-error" role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive"><XCircle className="size-4 shrink-0" aria-hidden />{copy.extUnsupported}</p>
                ) : searchError ? (
                  <p id="domain-search-error" role="alert" className="text-sm text-destructive">{searchError}</p>
                ) : (
                  <p id="domain-search-hint" className="text-xs leading-relaxed text-muted-foreground">{copy.hint}</p>
                )}

                <TldPicker
                  tlds={sellableTlds}
                  selected={matchedTld?.tld ?? null}
                  onSelect={applyExtension}
                  money={money}
                  labels={{
                    popular: copy.popularTlds,
                    all: copy.allTlds,
                    searchPlaceholder: copy.tldSearchPlaceholder,
                    empty: copy.tldsEmpty,
                    viewAll: copy.viewAllTlds,
                    more: (count) => copy.tldMatchCount.replace("{count}", num(count)),
                  }}
                />

                <div className="grid grid-cols-3 gap-2 rounded-3xl border border-primary/15 bg-primary/5 p-3 sm:gap-4 sm:p-4">
                  {[
                    { icon: Zap, title: copy.trustFastTitle, desc: copy.trustFastDesc },
                    { icon: ShieldCheck, title: copy.trustSecureTitle, desc: copy.trustSecureDesc },
                    { icon: Headphones, title: copy.trustSupportTitle, desc: copy.trustSupportDesc },
                  ].map((item) => (
                    <div key={item.title} className="flex flex-col items-center gap-1.5 text-center">
                      <item.icon className="size-6 text-primary" aria-hidden />
                      <strong className="text-xs font-bold sm:text-sm">{item.title}</strong>
                      <span className="text-pretty text-[0.65rem] leading-relaxed text-muted-foreground sm:text-xs">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cinematic globe loop: renders on the left in RTL, above on mobile. */}
              <div className="order-1 lg:order-2">
                <GlobeStage
                  tlds={heroTlds}
                  onSelectTld={applyExtension}
                  selectLabel={copy.badgeSelect}
                  caption={copy.heroTldCount.replace("{count}", num(Math.max(sellableTlds.length, 200)))}
                  captionHint={copy.heroTldCountHint}
                />
              </div>
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
          {/* Suppressed while the search field is already showing the verdict, so a
              taken domain is reported once instead of twice. */}
          {hasSearched && lookups.length === 0 && busy !== "lookup" && !activeVerdict && <Card><CardHeader><CardTitle>{copy.noResult}</CardTitle><CardDescription>{copy.noResultDescription}</CardDescription></CardHeader></Card>}
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

