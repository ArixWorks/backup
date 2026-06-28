"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Search, SearchX, X, Zap } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { FlashCard, type FlashSale } from "@/components/flash-card"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/components/i18n-provider"
import { CategoryFollowButton } from "@/components/category-follow-button"
import { cn } from "@/lib/utils"

type Category = { category: string; count: number }
type FlashSort = "newest" | "price_asc" | "price_desc" | "popular"

export function FlashBrowser() {
  const { t, num } = useI18n()
  const [rawSearch, setRawSearch] = useState("")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("")
  const [sort, setSort] = useState<FlashSort>("newest")

  // Debounce the text input so we don't refetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(rawSearch.trim()), 350)
    return () => clearTimeout(id)
  }, [rawSearch])

  const { data: catData } = useSWR<{ data: Category[] }>(
    "/api/v1/flash-sales/categories",
    fetcher,
  )
  const categories = catData?.data ?? []

  const query = useMemo(() => {
    const sp = new URLSearchParams()
    if (search) sp.set("search", search)
    if (category) sp.set("category", category)
    if (sort !== "newest") sp.set("sort", sort)
    const qs = sp.toString()
    return qs ? `?${qs}` : ""
  }, [search, category, sort])

  const { data, isLoading, mutate } = useSWR<{ data: FlashSale[] }>(
    `/api/v1/flash-sales${query}`,
    fetcher,
    { refreshInterval: 15000 },
  )
  const sales = data?.data ?? []

  const sortLabels: Record<FlashSort, string> = {
    newest: t("sort.newest"),
    popular: t("sort.popular"),
    price_asc: t("sort.priceAsc"),
    price_desc: t("sort.priceDesc"),
  }

  return (
    <div className="space-y-4">
      {/* Search + sort */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder={t("search.placeholder")}
            className="pr-9"
            aria-label={t("search.placeholder")}
          />
          {rawSearch && (
            <button
              type="button"
              onClick={() => setRawSearch("")}
              aria-label="clear"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as FlashSort)}>
          <SelectTrigger className="sm:w-44" aria-label={t("sort.label")}>
            <SelectValue placeholder={t("sort.label")}>
              {(value) => sortLabels[value as FlashSort]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t("sort.newest")}</SelectItem>
            <SelectItem value="popular">{t("sort.popular")}</SelectItem>
            <SelectItem value="price_asc">{t("sort.priceAsc")}</SelectItem>
            <SelectItem value="price_desc">{t("sort.priceDesc")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip active={category === ""} onClick={() => setCategory("")}>
            {t("search.all")}
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.category}
              active={category === c.category}
              onClick={() => setCategory(c.category)}
            >
              {c.category}
              <span className="text-[10px] opacity-70">{num(c.count)}</span>
            </Chip>
          ))}
        </div>
      )}

      {/* Follow the selected category for new-product alerts */}
      {category && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            با دنبال‌کردن این دسته، هنگام افزودن محصول جدید با صدا مطلع می‌شوید.
          </p>
          <CategoryFollowButton category={category} />
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        search || category ? (
          <EmptyState
            icon={SearchX}
            title={t("search.noResults")}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRawSearch("")
                  setSearch("")
                  setCategory("")
                }}
              >
                {t("search.all")}
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Zap} title={t("flash.empty")} />
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sales.map((s) => (
            <FlashCard key={s.id} sale={s} onPurchased={() => mutate()} />
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/40",
      )}
    >
      {children}
    </button>
  )
}
