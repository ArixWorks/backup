"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X, Plus, GripVertical } from "lucide-react"
import { apiGet } from "@/lib/api-client"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type RelationItem = { targetType: string; targetId: string; label?: string; thumb?: string | null }

type SearchResult = { targetId: string; label: string; thumb?: string | null; targetType: string }

/**
 * Async searchable picker for one relation slot. Supports single/multiple
 * selection with ordering. `targetType` is the registry relation target
 * (e.g. "content:article", "product", "auction", "giveaway").
 */
export function RelationPicker({
  label,
  help,
  targetType,
  multiple,
  max,
  value,
  onChange,
}: {
  label: string
  help?: string
  targetType: string
  multiple?: boolean
  max?: number
  value: RelationItem[]
  onChange: (items: RelationItem[]) => void
}) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  useEffect(() => {
    let active = true
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiGet<{ data: { items: SearchResult[] } }>(
          `/api/v1/admin/content/relation-search?targetType=${encodeURIComponent(targetType)}&q=${encodeURIComponent(q)}`,
        )
        if (active) setResults(res.data?.items ?? [])
      } catch {
        if (active) setResults([])
      } finally {
        if (active) setLoading(false)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [q, targetType])

  const atMax = max !== undefined && value.length >= max
  const selectedIds = new Set(value.map((v) => v.targetId))

  function add(r: SearchResult) {
    if (selectedIds.has(r.targetId)) return
    const next = multiple ? [...value, toItem(r)] : [toItem(r)]
    onChange(max ? next.slice(0, max) : next)
    if (!multiple) setOpen(false)
    setQ("")
  }

  function toItem(r: SearchResult): RelationItem {
    // Persist the resolved kind ("content"/"product"/...) returned by the API,
    // not the registry target (e.g. "content:article").
    return { targetType: r.targetType, targetId: r.targetId, label: r.label, thumb: r.thumb }
  }

  function remove(id: string) {
    onChange(value.filter((v) => v.targetId !== id))
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold">{label}</label>
        {max !== undefined && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {value.length}/{max}
          </span>
        )}
      </div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}

      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((item, i) => (
            <li
              key={item.targetId}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 p-2"
            >
              {multiple && (
                <span className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={i === 0}
                    aria-label="بالا"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              {item.thumb ? (

                <img
                  src={item.thumb || "/placeholder.svg"}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded object-cover"
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate text-sm">{item.label ?? item.targetId}</span>
              <button
                type="button"
                onClick={() => remove(item.targetId)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="حذف"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!atMax && (
        <div ref={boxRef} className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            placeholder="جستجو برای افزودن…"
            className="pr-9"
          />
          {open && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-lg">
              {loading ? (
                <p className="p-3 text-center text-xs text-muted-foreground">در حال جستجو…</p>
              ) : results.length === 0 ? (
                <p className="p-3 text-center text-xs text-muted-foreground">نتیجه‌ای یافت نشد</p>
              ) : (
                results.map((r) => {
                  const picked = selectedIds.has(r.targetId)
                  return (
                    <button
                      key={r.targetId}
                      type="button"
                      onClick={() => add(r)}
                      disabled={picked}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right text-sm transition-colors",
                        picked
                          ? "cursor-default opacity-40"
                          : "hover:bg-secondary",
                      )}
                    >
                      {r.thumb ? (

                        <img src={r.thumb || "/placeholder.svg"} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">{r.label}</span>
                      {!picked && <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
