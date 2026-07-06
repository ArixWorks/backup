import Link from "next/link"
import { FileText, Plus } from "lucide-react"
import { prisma } from "@/lib/db"
import { listContentTypes } from "@/lib/cms/registry"
import { ContentIcon } from "@/components/admin/content/content-icon"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminContentHome() {
  const types = listContentTypes()
  const counts = await prisma.content.groupBy({
    by: ["type", "status"],
    _count: { _all: true },
  })

  function countFor(typeKey: string) {
    const rows = counts.filter((c) => c.type === typeKey)
    const total = rows.reduce((n, r) => n + r._count._all, 0)
    const published = rows
      .filter((r) => r.status === "PUBLISHED")
      .reduce((n, r) => n + r._count._all, 0)
    return { total, published }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">مدیریت محتوا</h1>
      </div>
      <p className="text-sm text-muted-foreground text-pretty">
        سیستم مدیریت محتوای ماژولار. هر نوع محتوا از ویرایشگر، رسانه، سئو و نسخه‌بندی مشترک استفاده
        می‌کند.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => {
          const { total, published } = countFor(t.key)
          return (
            <Link
              key={t.key}
              href={`/admin/content/${t.key}`}
              className="glass group flex flex-col gap-3 rounded-2xl border border-border/60 p-4 shadow-sm transition-colors hover:border-primary/50"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <ContentIcon name={t.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-bold">{t.labelPlural}</h2>
                  <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground tabular-nums">
                  {total} مورد • {published} منتشرشده
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 font-semibold text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  مدیریت
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
