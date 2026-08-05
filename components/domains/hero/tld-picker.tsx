"use client"

import { useDeferredValue, useMemo, useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, Flame, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlowingButton } from "@/components/ui/glowing-button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface PickerTld {
  id: string
  tld: string
  basePriceIrt: string
}

/** How many rows we put in the DOM at once. The rest arrive as the user scrolls. */
const PAGE = 40

/**
 * Edge-glow colour per popular chip, cycled by position.
 *
 * Deliberately the chart tokens rather than literal hexes: this app ships
 * several palettes, and tokens keep the chips in step with whichever one is
 * active. `--chart-5` is left out because it is a near-grey and reads as a dead
 * chip next to the others.
 */
const GLOWS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"]

/**
 * Popular extension chips plus a lazily-populated "all extensions" dropdown.
 *
 * The catalog is expected to grow past 200 entries, so the dropdown never
 * renders the whole list: the panel itself only mounts on open, and rows are
 * paged in on scroll. Filtering runs against a deferred query so typing stays
 * responsive no matter how large the catalog gets.
 */
export function TldPicker({
  tlds,
  selected,
  onSelect,
  money,
  labels,
}: {
  tlds: PickerTld[]
  selected: string | null
  onSelect: (tld: string) => void
  money: (value: string) => string
  labels: {
    popular: string
    all: string
    searchPlaceholder: string
    empty: string
    viewAll: string
    more: (count: number) => string
  }
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const deferredQuery = useDeferredValue(query)

  // The catalog arrives ordered by the admin's displayOrder, so the first few
  // entries are exactly the extensions the business wants to promote.
  const popular = useMemo(() => tlds.slice(0, 5), [tlds])

  const matches = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase().replace(/^\./, "")
    if (!needle) return tlds
    return tlds.filter((item) => item.tld.toLowerCase().includes(needle))
  }, [tlds, deferredQuery])

  const visible = useMemo(() => matches.slice(0, limit), [matches, limit])

  function pick(tld: string) {
    onSelect(tld)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Flame className="size-4 text-chart-2" aria-hidden />
        <span className="text-sm font-bold">{labels.popular}</span>
      </div>

      {/* Single row at every width: the chips scroll horizontally instead of
          wrapping, so the "all extensions" trigger never drops to a second line
          and leaves a gap under the rail on narrow screens. */}
      <div className="flex items-center gap-2">
        {/* `w-0 grow`, not `flex-1 min-w-0`: this row sits inside a grid column
            whose track is sized from content, and with an auto basis the rail
            still handed its full max-content up to the track - blowing the whole
            hero column past the viewport on narrow phones. A definite 0 width
            contributes nothing intrinsically, so the track stays put and the
            chips scroll inside the rail instead. */}
        <div className="no-scrollbar -mx-1 flex w-0 grow items-center gap-2 overflow-x-auto px-1 py-1">
          {popular.map((item, index) => {
            const active = selected === item.tld
            return (
              <GlowingButton
                key={item.id}
                onClick={() => onSelect(item.tld)}
                aria-pressed={active}
                active={active}
                glow={GLOWS[index % GLOWS.length]}
                className="font-mono font-bold"
              >
                <span dir="ltr">{item.tld}</span>
                {active ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
              </GlowingButton>
            )
          })}
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className="h-10 shrink-0 rounded-md px-3"
                aria-label={labels.all}
              />
            }
          >
            <Plus className="size-4" aria-hidden />
            <ChevronDown className="size-3.5 opacity-60" aria-hidden />
          </PopoverTrigger>
          <PopoverContent className="w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
            <div className="flex flex-col gap-2 border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground" aria-hidden />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setLimit(PAGE)
                  }}
                  placeholder={labels.searchPlaceholder}
                  aria-label={labels.searchPlaceholder}
                  className="h-10 rounded-xl pr-9"
                />
              </div>
              <span className="text-xs text-muted-foreground">{labels.more(matches.length)}</span>
            </div>

            <div
              className="max-h-64 overflow-y-auto overscroll-contain p-1"
              onScroll={(event) => {
                const el = event.currentTarget
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
                  setLimit((current) => (current < matches.length ? current + PAGE : current))
                }
              }}
            >
              {visible.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">{labels.empty}</p>
              ) : (
                visible.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pick(item.tld)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-start transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <span dir="ltr" className="font-mono text-sm font-bold">{item.tld}</span>
                    <span className="text-xs text-muted-foreground">{money(item.basePriceIrt)}</span>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-border p-2">
              <Button render={<Link href="/domains/tlds" />} variant="ghost" size="sm" className="w-full rounded-lg">
                {labels.viewAll}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
