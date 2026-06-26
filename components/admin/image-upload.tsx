"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { UploadCloud, X, Loader2 } from "lucide-react"
import { ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"

const ACCEPT = "image/jpeg,image/png,image/webp"
const MAX_BYTES = 6 * 1024 * 1024

/**
 * Reusable image picker that uploads to the shared /api/v1/uploads Blob route
 * and reports the resulting public URL via onChange. Shows a live preview with
 * a clear button; clicking the empty state opens the file picker.
 */
export function ImageUpload({
  value,
  onChange,
  folder = "giveaways",
  aspect = "aspect-video",
}: {
  value: string
  onChange: (url: string) => void
  folder?: string
  aspect?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error("فقط تصویر JPG، PNG یا WebP مجاز است")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("حجم تصویر نباید بیشتر از ۶ مگابایت باشد")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", folder)
      const res = await fetch("/api/v1/uploads", { method: "POST", body: fd, credentials: "include" })
      const json = await res.json()
      if (!res.ok) throw new ApiError(json?.error?.message || "خطا در آپلود", json?.error?.code || "UPLOAD_FAILED", res.status)
      onChange(json.url as string)
      toast.success("تصویر آپلود شد")
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "خطا در آپلود تصویر")
    } finally {
      setUploading(false)
    }
  }

  if (value) {
    return (
      <div className={cn("relative w-full overflow-hidden rounded-lg border border-border", aspect)}>
        <Image src={value || "/placeholder.svg"} alt="پیش‌نمایش تصویر" fill className="object-cover" sizes="400px" />
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="حذف تصویر"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition hover:bg-background"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-secondary/30 text-muted-foreground transition hover:border-primary/50 hover:bg-secondary/50 disabled:opacity-60",
          aspect,
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <>
            <UploadCloud className="h-6 w-6" />
            <span className="text-xs">برای آپلود تصویر کلیک کنید</span>
            <span className="text-[11px] text-muted-foreground/70">JPG, PNG, WebP · حداکثر ۶ مگابایت</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ""
        }}
      />
    </>
  )
}
