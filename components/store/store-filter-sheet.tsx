"use client"

import { useEffect, useState } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { SlidersHorizontal } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export type FlashSort = "newest" | "price_asc" | "price_desc" | "popular" | "rating"

/** A committed set of store filters. Prices are in Toman (undefined = no bound). */
export interface StoreFilters {
  sort: FlashSort
  maxPrice?: number
  inStockOnly: boolean
  instantOnly: boolean
}

export const DEFAULT_FILTERS: StoreFilters = {
  sort: "newest",
  maxPrice: undefined,
  inStockOnly: false,
  instantOnly: false,
}

// Price buckets shown as chips (value = inclusive max in Toman; undefined = "همه").
const PRICE_BUCKETS: { key: string; max?: number }[] = [
  { key: "all", max: undefined },
  { key: "1m", max: 1_000_000 },
  { key: "3m", max: 3_000_000 },
  { key: "10m", max: 10_000_000 },
]

/** Number of active (non-default) filters, for the toolbar badge. */
export function countActiveFilters(f: StoreFilters): number {
  let n = 0
  if (f.sort !== DEFAULT_FILTERS.sort) n += 1
  if (f.maxPrice != null) n += 1
  if (f.inStockOnly) n += 1
  if (f.instantOnly) n += 1
  return n
}

export function StoreFilterSheet({
  value,
  onApply,
}: {
  value: StoreFilters
  onApply: (next: StoreFilters) => void
}) {
  const { t, dir, num } = useI18n()
  const [open, setOpen] = useState(false)
  // Draft state: edited freely inside the sheet, only committed on "apply".
  const [draft, setDraft] = useState<StoreFilters>(value)

  // Re-sync the draft with committed filters whenever the sheet is (re)opened.
  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const sortOptions: { key: FlashSort; label: string }[] = [
    { key: "newest", label: t("sort.newest") },
    { key: "popular", label: t("sort.popular") },
    { key: "rating", label: t("sort.rating") },
    { key: "price_asc", label: t("sort.priceAsc") },
    { key: "price_desc", label: t("sort.priceDesc") },
  ]

  const activeCount = countActiveFilters(value)

  function apply() {
    onApply(draft)
    setOpen(false)
  }

  function clear() {
    setDraft(DEFAULT_FILTERS)
    onApply(DEFAULT_FILTERS)
    setOpen(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label={t("store.filters")}
        className={cn(
          "active:scale-press relative flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
          activeCount > 0
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground",
        )}
      >
        <SlidersHorizontal className="size-4" />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background">
            {num(activeCount)}
          </span>
        )}
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-overlay/70 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          dir={dir}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-xl rounded-t-3xl border-t border-primary/15 bg-card p-4 pb-safe outline-none",
            "max-h-[85dvh] overflow-y-auto",
            "data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{t("store.filters")}</DialogPrimitive.Title>

          {/* grab handle */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30" />

          {/* Sort */}
          <h3 className="mb-2.5 text-sm font-extrabold text-foreground">{t("sort.label")}</h3>
          <div className="grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
            {sortOptions.map((option) => (
              <ChipButton
                key={option.key}
                label={option.label}
                active={draft.sort === option.key}
                onClick={() => setDraft((d) => ({ ...d, sort: option.key }))}
              />
            ))}
          </div>

          {/* Price range */}
          <h3 className="mb-2.5 mt-5 text-sm font-extrabold text-foreground">{t("store.priceRange")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {PRICE_BUCKETS.map((bucket) => (
              <ChipButton
                key={bucket.key}
                label={bucket.max == null ? t("store.filterAll") : t("store.priceUnder").replace("{amount}", num(bucket.max))}
                active={draft.maxPrice === bucket.max}
                onClick={() => setDraft((d) => ({ ...d, maxPrice: bucket.max }))}
              />
            ))}
          </div>

          {/* Toggles */}
          <div className="mt-5 flex flex-col gap-2">
            <ToggleRow
              label={t("store.inStockOnly")}
              checked={draft.inStockOnly}
              onChange={(checked) => setDraft((d) => ({ ...d, inStockOnly: checked }))}
            />
            <ToggleRow
              label={t("store.instantOnly")}
              checked={draft.instantOnly}
              onChange={(checked) => setDraft((d) => ({ ...d, instantOnly: checked }))}
            />
          </div>

          {/* Footer actions */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={clear}
              className="active:scale-press flex items-center justify-center rounded-2xl border border-border bg-background px-3 py-3 text-sm font-bold text-foreground transition-colors hover:border-primary/30"
            >
              {t("store.clearFilters")}
            </button>
            <button
              type="button"
              onClick={apply}
              className="active:scale-press flex items-center justify-center rounded-2xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("store.applyFilters")}
            </button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ChipButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center rounded-2xl border px-3 py-3 text-[13px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      <span dir="auto">{label}</span>
    </button>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3.5 transition-colors hover:border-primary/25">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}
