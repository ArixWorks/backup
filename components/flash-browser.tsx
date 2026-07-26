"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Search, SearchX, X, Zap } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { FlashCard, type FlashSale } from "@/components/flash-card"
import { EmptyState } from "@/components/empty-state"
import { CardSkeleton } from "@/components/loading-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n } from "@/components/i18n-provider"
import { CategoryFollowButton } from "@/components/category-follow-button"

type FlashSort = "newest" | "price_asc" | "price_desc" | "popular"

export function FlashBrowser({ categorySlug, categoryName }: { categorySlug?: string; categoryName?: string }) {
  const { t, locale } = useI18n()
  const [rawSearch, setRawSearch] = useState("")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<FlashSort>("newest")

  useEffect(() => {
    const id = setTimeout(() => setSearch(rawSearch.trim()), 350)
    return () => clearTimeout(id)
  }, [rawSearch])

  const query = useMemo(() => {
    const params = new URLSearchParams({ locale })
    if (search) params.set("search", search)
    if (categorySlug) params.set("category", categorySlug)
    if (sort !== "newest") params.set("sort", sort)
    return `?${params.toString()}`
  }, [search, categorySlug, sort, locale])

  const { data, isLoading, mutate } = useSWR<{ data: FlashSale[] }>(`/api/v1/flash-sales${query}`, fetcher, { refreshInterval: 15000 })
  const sales = data?.data ?? []
  const sortLabels: Record<FlashSort, string> = { newest: t("sort.newest"), popular: t("sort.popular"), price_asc: t("sort.priceAsc"), price_desc: t("sort.priceDesc") }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={rawSearch} onChange={(event) => setRawSearch(event.target.value)} placeholder={t("search.placeholder")} className="pr-9" aria-label={t("search.placeholder")} />
          {rawSearch && <button type="button" onClick={() => setRawSearch("")} aria-label="Clear search" className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as FlashSort)}>
          <SelectTrigger className="sm:w-44" aria-label={t("sort.label")}><SelectValue>{(value) => sortLabels[value as FlashSort]}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="newest">{t("sort.newest")}</SelectItem><SelectItem value="popular">{t("sort.popular")}</SelectItem><SelectItem value="price_asc">{t("sort.priceAsc")}</SelectItem><SelectItem value="price_desc">{t("sort.priceDesc")}</SelectItem></SelectContent>
        </Select>
      </div>

      {categoryName && <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3"><p className="text-xs text-muted-foreground">{t("flash.followCategoryHint")}</p><CategoryFollowButton category={categoryName} /></div>}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 web:lg:grid-cols-3 web:xl:grid-cols-4">{[0, 1, 2, 3, 4, 5].map((item) => <CardSkeleton key={item} />)}</div>
      ) : sales.length === 0 ? (
        search ? <EmptyState icon={SearchX} title={t("search.noResults")} action={<Button variant="outline" size="sm" onClick={() => { setRawSearch(""); setSearch("") }}>{t("search.all")}</Button>} /> : <EmptyState icon={Zap} title={categorySlug ? t("store.categoryEmpty") : t("flash.empty")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 web:lg:grid-cols-3 web:xl:grid-cols-4">{sales.map((sale) => <FlashCard key={sale.id} sale={sale} onPurchased={() => mutate()} />)}</div>
      )}
    </div>
  )
}
