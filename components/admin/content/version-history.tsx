"use client"

import { useState } from "react"
import useSWR from "swr"
import { History, RotateCcw, X } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { RichContent } from "@/components/rich-content"
import { cn } from "@/lib/utils"

type Revision = {
  id: string
  html: string
  status: string
  createdAt: string
}

function fmt(iso: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    )
  } catch {
    return iso
  }
}

/**
 * Version history for a content item's body. Reuses the shared revisions API
 * (entityType = content type key, field = "body") and RichContent preview.
 */
export function VersionHistory({
  typeKey,
  contentId,
  onRestore,
}: {
  typeKey: string
  contentId: string
  onRestore: (html: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<Revision | null>(null)
  const { data } = useSWR<{ items: Revision[] }>(
    open
      ? `/api/v1/admin/revisions?entityType=${typeKey}&entityId=${contentId}&field=body`
      : null,
    fetcher,
  )
  const items = data?.items ?? []

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
      >
        <History className="h-4 w-4 text-muted-foreground" />
        تاریخچه نسخه‌ها
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative ml-auto flex h-full w-full max-w-md flex-col border-r border-border/60 bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 p-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h2 className="font-bold">تاریخچه نسخه‌ها</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="بستن"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  هنوز نسخه‌ای ثبت نشده است.
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((rev) => (
                    <li
                      key={rev.id}
                      className="rounded-xl border border-border/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{fmt(rev.createdAt)}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-bold",
                            rev.status === "published"
                              ? "bg-success/15 text-success"
                              : "bg-secondary text-muted-foreground",
                          )}
                        >
                          {rev.status === "published" ? "منتشرشده" : "پیش‌نویس"}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreview(rev)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          پیش‌نمایش
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRestore(rev.html)
                            setOpen(false)
                          }}
                          className="mr-auto flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          بازگردانی
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {preview && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={() => setPreview(null)}
              />
              <div className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"
                  aria-label="بستن"
                >
                  <X className="h-5 w-5" />
                </button>
                <RichContent content={preview.html} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
