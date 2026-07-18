"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Search, UploadCloud, ImageIcon, FileText, Film, Music, Archive, File } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { listMedia, uploadMedia, type MediaAssetDTO } from "./client-api"
import { formatBytes } from "@/lib/rich-content/media"

const KIND_TABS: { key: string; label: string }[] = [
  { key: "", label: "همه" },
  { key: "IMAGE", label: "تصاویر" },
  { key: "VIDEO", label: "ویدیو" },
  { key: "AUDIO", label: "صوت" },
  { key: "DOCUMENT", label: "اسناد" },
  { key: "ARCHIVE", label: "آرشیو" },
]

function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const map: Record<string, typeof ImageIcon> = {
    IMAGE: ImageIcon,
    VIDEO: Film,
    AUDIO: Music,
    DOCUMENT: FileText,
    ARCHIVE: Archive,
  }
  const Icon = map[kind] ?? File
  return <Icon className={className} aria-hidden />
}

export function MediaManager({
  open,
  onOpenChange,
  onSelect,
  accept,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Called with the chosen asset when the user picks one. */
  onSelect: (asset: MediaAssetDTO) => void
  /** Restrict picker to a single kind (e.g. "IMAGE"). */
  accept?: string
}) {
  const [items, setItems] = useState<MediaAssetDTO[]>([])
  const [q, setQ] = useState("")
  const [kind, setKind] = useState(accept ?? "")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listMedia({ q, kind: kind || undefined, sort: "recent" })
      setItems(res.items)
    } catch (err) {
      console.log("[v0] media list failed:", err)
    } finally {
      setLoading(false)
    }
  }, [q, kind])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files)
      if (!list.length) return
      setUploading(true)
      try {
        for (const file of list) {
          const asset = await uploadMedia(file)
          setItems((prev) => [asset, ...prev])
        }
      } catch (err) {
        console.log("[v0] media upload failed:", err)
      } finally {
        setUploading(false)
      }
    },
    [],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>کتابخانه رسانه</DialogTitle>
          <DialogDescription>یک فایل انتخاب کنید یا فایل جدید بارگذاری کنید</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute inset-inline-start-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refresh()}
              placeholder="جستجو…"
              className="ps-8"
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            بارگذاری
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept={accept === "IMAGE" ? "image/*" : undefined}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {!accept && (
          <div className="flex flex-wrap gap-1">
            {KIND_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setKind(t.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  kind === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            "grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-dashed p-2 sm:grid-cols-4",
            dragOver ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              فایلی یافت نشد. برای بارگذاری، فایل را اینجا رها کنید.
            </p>
          ) : (
            items.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onSelect(asset)}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card text-start transition-colors hover:border-primary"
              >
                <div className="flex aspect-square items-center justify-center bg-muted">
                  {asset.kind === "IMAGE" ? (

                    <img src={asset.url || "/placeholder.svg"} alt={asset.alt ?? asset.filename} className="size-full object-cover" loading="lazy" />
                  ) : (
                    <KindIcon kind={asset.kind} className="size-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-1.5">
                  <p className="truncate text-xs font-medium">{asset.filename}</p>
                  <p className="text-[10px] text-muted-foreground">{formatBytes(asset.size)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
