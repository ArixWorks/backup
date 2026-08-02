"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { LayoutGrid, List, Search, SearchX, X, Zap } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { StoreProductCard } from "@/components/store/store-product-card"
import type { FlashSale } from "@/components/flash-card"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Category = { id: string; slug: string; name: string; description: string | null; count: number }
type FlashSort = "newest" | "price_asc" | "price_desc" | "popular"
type ViewMode = "grid" | "list"

export function StoreCatalog() {
  const { t, locale, num } = useI18n()
  const [activeCat, setActiveCat] = useState("all")
  const [rawSearch, setRawSearch] = useState("")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<FlashSort>("newest")
  const [view, setView] = useState<ViewMode>("grid")

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
    if (sort !== "newest") params.set("sort", sort)
    return `?${params.toString()}`
  }, [search, activeCat, sort, locale])

  const { data, isLoading } = useSWR<{ data: FlashSale[] }>(`/api/v1/flash-sales${query}`, fetcher, {
    refreshInterval: 15000,
  })
  const sales = data?.data ?? []
  const sortLabels: Record<FlashSort, string> = {
    newest: t("sort.newest"),
    popular: t("sort.popular"),
    price_asc: t("sort.priceAsc"),
    price_desc: t("sort.priceDesc"),
  }

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

      {/* Result count + controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-xl border border-border bg-secondary/30 p-0.5">
            <ViewToggle icon={LayoutGrid} label={t("store.gridView")} active={view === "grid"} onClick={() => setView("grid")} />
            <ViewToggle icon={List} label={t("store.listView")} active={view === "list"} onClick={() => setView("list")} />
          </div>
          <Select value={sort} onValueChange={(value) => setSort(value as FlashSort)}>
            <SelectTrigger className="h-9 w-auto gap-1.5 rounded-xl text-xs" aria-label={t("sort.label")}>
              <SelectValue>{(value) => sortLabels[value as FlashSort]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("sort.newest")}</SelectItem>
              <SelectItem value="popular">{t("sort.popular")}</SelectItem>
              <SelectItem value="price_asc">{t("sort.priceAsc")}</SelectItem>
              <SelectItem value="price_desc">{t("sort.priceDesc")}</SelectItem>
            </SelectContent>
          </Select>
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

function ViewToggle({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof LayoutGrid
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg transition-colors",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  )
}
