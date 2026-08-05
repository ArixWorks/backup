"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowRight, ArrowUpWideNarrow, Loader2, Search } from "lucide-react"
import { apiGet } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/components/i18n-provider"
import { DOMAIN_COPY } from "@/lib/i18n/domain-copy"

interface Tld { id: string; tld: string; title: string; basePriceIrt: string; listPriceIrt: string | null; supported: boolean }

type Sort = "priceAsc" | "priceDesc" | "name"

export function TldCatalog() {
  const { locale, price, dir } = useI18n()
  const copy = DOMAIN_COPY[locale]
  const money = (value: string | number) => price(Number(value))
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<Sort>("priceAsc")

  const { data, isLoading } = useSWR<{ data: { tlds: Tld[] } }>("/api/v1/domains/tlds", apiGet)
  // Only sellable extensions belong in the public catalog.
  const sellable = useMemo(() => (data?.data.tlds ?? []).filter((item) => item.supported), [data])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\./, "")
    const filtered = q ? sellable.filter((item) => item.tld.toLowerCase().includes(q) || item.title.toLowerCase().includes(q)) : sellable
    const arr = [...filtered]
    if (sort === "priceAsc") arr.sort((a, b) => Number(a.basePriceIrt) - Number(b.basePriceIrt))
    else if (sort === "priceDesc") arr.sort((a, b) => Number(b.basePriceIrt) - Number(a.basePriceIrt))
    else arr.sort((a, b) => a.tld.localeCompare(b.tld))
    return arr
  }, [sellable, query, sort])

  const sortOptions: { value: Sort; label: string; icon: typeof ArrowDownAZ }[] = [
    { value: "priceAsc", label: copy.tldsSortPriceAsc, icon: ArrowDownWideNarrow },
    { value: "priceDesc", label: copy.tldsSortPriceDesc, icon: ArrowUpWideNarrow },
    { value: "name", label: copy.tldsSortName, icon: ArrowDownAZ },
  ]

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6 md:py-12" dir={dir}>
      <div className="flex flex-col gap-4">
        <Button render={<Link href="/domains" />} variant="ghost" size="sm" className="w-fit rounded-xl text-muted-foreground">
          <ArrowRight data-icon="inline-start" className="size-4" />{copy.tldsBack}
        </Button>
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-2xl font-bold md:text-3xl">{copy.tldsTitle}</h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">{copy.tldsSubtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.tldsSearchPlaceholder} aria-label={copy.tldsSearchPlaceholder} className="h-11 rounded-xl bg-background/70 pe-10" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={copy.tldsSortLabel}>
          {sortOptions.map((option) => {
            const Icon = option.icon
            const active = sort === option.value
            return (
              <Button key={option.value} variant={active ? "secondary" : "ghost"} size="sm" className="rounded-xl" aria-pressed={active} onClick={() => setSort(option.value)}>
                <Icon data-icon="inline-start" className="size-4" />{option.label}
              </Button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="size-5 animate-spin" /><span>{copy.tldsSearchPlaceholder}</span></div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/50 py-16 text-center text-muted-foreground">{copy.tldsEmpty}</div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((item) => (
            <li key={item.id}>
              <Link
                href={`/domains?ext=${encodeURIComponent(item.tld)}`}
                aria-label={`${item.tld} — ${copy.tldsInsertAria}`}
                className="group flex h-full flex-col gap-1 rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <span dir="ltr" className="font-mono text-lg font-bold text-foreground group-hover:text-primary">{item.tld}</span>
                <span className="text-sm font-semibold text-primary">{money(item.basePriceIrt)}</span>
                {/* Reference price, shown only when it is genuinely higher. */}
                {Number(item.listPriceIrt ?? 0) > Number(item.basePriceIrt) ? (
                  <span dir="ltr" className="text-xs font-medium text-muted-foreground line-through decoration-muted-foreground/60">
                    {money(item.listPriceIrt as string)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
