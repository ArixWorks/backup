"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Plus, Search, Trash2, Pencil } from "lucide-react"
import { fetcher, apiDelete } from "@/lib/api-client"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { buttonVariants } from "@/components/ui/button"
import { ContentIcon } from "./content-icon"
import { cn } from "@/lib/utils"

type Row = {
  id: string
  title: string
  slug: string
  status: string
  updatedAt: string
  category?: { id: string; name: string } | null
  navShow: boolean
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "پیش‌نویس", className: "bg-secondary text-muted-foreground" },
  SCHEDULED: { label: "زمان‌بندی‌شده", className: "bg-primary/10 text-primary" },
  PUBLISHED: { label: "منتشرشده", className: "bg-success/15 text-success" },
  ARCHIVED: { label: "بایگانی", className: "bg-destructive/10 text-destructive" },
}

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function ContentListView({
  typeKey,
  labelPlural,
  labelSingular,
  icon,
  mode,
}: {
  typeKey: string
  labelPlural: string
  labelSingular: string
  icon: string
  mode: "collection" | "singleton"
  listColumns: string[]
  fields: { key: string; label: string }[]
}) {
  const [q, setQ] = useState("")
  const { data, isLoading, mutate } = useSWR<{ data: { items: Row[]; total: number } }>(
    `/api/v1/admin/content?type=${typeKey}`,
    fetcher,
    { refreshInterval: 15000 },
  )
  const items = data?.data?.items ?? []
  const rows = items.filter((r) => !q || r.title.includes(q) || r.slug.includes(q))

  const isSingletonFull = mode === "singleton" && items.length >= 1

  async function remove(id: string, title: string) {
    if (!confirm(`حذف «${title}»؟ این عمل قابل بازگشت نیست.`)) return
    try {
      await apiDelete(`/api/v1/admin/content/${id}`)
      toast.success("حذف شد")
      mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در حذف")
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ContentIcon name={icon} className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-extrabold">{labelPlural}</h1>
        </div>
        {!isSingletonFull && (
          <Link
            href={`/admin/content/${typeKey}/new`}
            className={cn(buttonVariants(), "gap-1.5")}
          >
            <Plus className="h-4 w-4" />
            {labelSingular} جدید
          </Link>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو در عنوان یا نامک…"
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl border border-border/60 p-10 text-center text-sm text-muted-foreground">
          هنوز محتوایی ثبت نشده است.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const st = STATUS_META[r.status] ?? STATUS_META.DRAFT
            return (
              <div
                key={r.id}
                className="glass flex items-center gap-3 rounded-xl border border-border/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{r.title}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                        st.className,
                      )}
                    >
                      {st.label}
                    </span>
                    {r.navShow && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                        در منو
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">
                    /{r.slug} • {fmtDate(r.updatedAt)}
                    {r.category ? ` • ${r.category.name}` : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/content/${typeKey}/${r.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
                  aria-label={`ویرایش ${r.title}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  ویرایش
                </Link>
                <button
                  type="button"
                  onClick={() => remove(r.id, r.title)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`حذف ${r.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
