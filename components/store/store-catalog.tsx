"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { LayoutGrid, List, Search, SearchX, X, Zap } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { StoreProductCard } from "@/components/store/store-product-card"
import { StoreFilterSheet, DEFAULT_FILTERS, type StoreFilters } from "@/components/store/store-filter-sheet"
import type { FlashSale } from "@/components/flash-card"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Category = { id: string; slug: string; name: string; description: string | null; count: number }
type ViewMode = "grid" | "list"

export function StoreCatalog() {
  const { t, locale, num } = useI18n()
  const [activeCat, setActiveCat] = useState("all")
  const [rawSearch, setRawSearch] = useState("")
  const [search, setSearch] = useState("")
  const [view, setView] = useState<ViewMode>("grid")
  const [filters, setFilters] = useState<StoreFilters>(DEFAULT_FILTERS)

  useEffect(() => {
    const id = setTimeout(() => setSearch(rawSearch.trim()), 350)
    return () => clearTimeout(id)
  }, [rawSearch])

  const { data: catData } = useSWR<{ data: Category[] }>("/api/v1/flash-sales/categories", fetcher)
  const categories = catData?.data ?? []

  const query = useMemo(() => {
    const params = new URLSearchParams({ locale })
    if (search) params.set("search", search)
    if (activeCat !== "all") params.set("category", activeCat)
    if (filters.sort !== "newest") params.set("sort", filters.sort)
    if (filters.maxPrice != null) params.set("maxPrice", String(filters.maxPrice))
    if (filters.inStockOnly) params.set("inStock", "1")
    if (filters.instantOnly) params.set("instant", "1")
    return `?${params.toString()}`
  }, [search, activeCat, filters, locale])

  const { data, isLoading } = useSWR<{ data: FlashSale[] }>(`/api/v1/flash-sales${query}`, fetcher, {
    refreshInterval: 15000,
  })
  const sales = data?.data ?? []

  return (
    <section aria-labelledby="store-catalog-title" className="flex flex-col gap-4">
      <h2 id="store-catalog-title" className="sr-only">
        {t("store.categoriesTitle")}
      </h2>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={rawSearch}
          onChange={(event) => setRawSearch(event.target.value)}
          placeholder={t("search.placeholder")}
          className="h-11 rounded-2xl pr-9"
          aria-label={t("search.placeholder")}
        />
        {rawSearch && (
          <button
            type="button"
            onClick={() => setRawSearch("")}
            aria-label={t("search.all")}
            className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Category pills */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <CategoryPill label={t("store.filterAll")} active={activeCat === "all"} onClick={() => setActiveCat("all")} />
        {categories.map((cat) => (
          <CategoryPill
            key={cat.id}
            label={cat.name}
            active={activeCat === cat.slug}
            onClick={() => setActiveCat(cat.slug)}
          />
        ))}
      </div>

      {/* Toolbar: controls on the left, result count on the right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <StoreFilterSheet value={filters} onApply={setFilters} />
          <ViewToggle
            mode={view}
            gridLabel={t("store.gridView")}
            listLabel={t("store.listView")}
            onToggle={() => setView((v) => (v === "grid" ? "list" : "grid"))}
          />
        </div>
        {!isLoading && (
          <p className="text-xs font-semibold text-muted-foreground">
            {num(sales.length)} {t("store.results")}
          </p>
        )}
      </div>

      {/* Products */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 web:lg:grid-cols-3 web:xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        search ? (
          <EmptyState
            icon={SearchX}
            title={t("search.noResults")}
            action={
              <Button variant="outline" size="sm" onClick={() => { setRawSearch(""); setSearch("") }}>
                {t("search.all")}
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Zap} title={activeCat !== "all" ? t("store.categoryEmpty") : t("flash.empty")} />
        )
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 web:lg:grid-cols-3 web:xl:grid-cols-4">
          {sales.map((sale) => (
            <StoreProductCard key={sale.id} sale={sale} layout="grid" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sales.map((sale) => (
            <StoreProductCard key={sale.id} sale={sale} layout="list" />
          ))}
        </div>
      )}
    </section>
  )
}

function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "border border-border bg-secondary/30 text-muted-foreground hover:text-foreground",
      )}
    >
      <span dir="auto">{label}</span>
    </button>
  )
}

// Single toggle button. Shows the icon of the view you'll switch TO and swaps
// its glyph on each tap (grid icon while in list view, list icon while in grid).
function ViewToggle({
  mode,
  gridLabel,
  listLabel,
  onToggle,
}: {
  mode: ViewMode
  gridLabel: string
  listLabel: string
  onToggle: () => void
}) {
  const nextIsGrid = mode === "list"
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={nextIsGrid ? gridLabel : listLabel}
      className="active:scale-press flex size-9 items-center justify-center rounded-xl border border-border bg-secondary/30 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {nextIsGrid ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
    </button>
  )
}
