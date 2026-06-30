"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { UploadCloud, X, Loader2, Replace } from "lucide-react"
import { ApiError } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { ImageCropper } from "@/components/admin/image-cropper"

const ACCEPT = "image/jpeg,image/png,image/webp"
const MAX_BYTES = 6 * 1024 * 1024

/** Map a Tailwind aspect class to a numeric ratio for the cropper. */
function aspectToRatio(aspect: string): number {
  if (aspect.includes("square")) return 1
  if (aspect.includes("video")) return 16 / 9
  const m = aspect.match(/aspect-\[(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\]/)
  if (m) return Number(m[1]) / Number(m[2])
  return 16 / 9
}

/**
 * Reusable image picker with a built-in Telegram-style crop step.
 *
 * Flow: click empty state → pick a file → crop modal opens locked to the target
 * aspect ratio → "ثبت تصویر" uploads the cropped WebP to /api/v1/uploads and
 * reports the public URL via onChange. The filled state shows a live preview
 * with hover actions to replace or delete the image.
 */
export function ImageUpload({
  value,
  onChange,
  folder = "giveaways",
  aspect = "aspect-video",
  cropShape = "rect",
}: {
  value: string
  onChange: (url: string) => void
  folder?: string
  aspect?: string
  cropShape?: "rect" | "round"
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const ratio = aspectToRatio(aspect)

  function pickFile(file: File) {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error("فقط تصویر JPG، PNG یا WebP مجاز است")
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("حجم تصویر نباید بیشتر از ۶ مگابایت باشد")
      return
    }
    // Open the cropper with a local object URL; upload happens after cropping.
    setCropSrc(URL.createObjectURL(file))
  }

  async function uploadBlob(blob: Blob) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", new File([blob], `crop-${Date.now()}.webp`, { type: "image/webp" }))
      fd.append("folder", folder)
      const res = await fetch("/api/v1/uploads", { method: "POST", body: fd, credentials: "include" })
      const json = await res.json()
      if (!res.ok)
        throw new ApiError(json?.error?.message || "خطا در آپلود", json?.error?.code || "UPLOAD_FAILED", res.status)
      onChange((json.url ?? json.data?.url) as string)
      toast.success("تصویر آپلود شد")
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "خطا در آپلود تصویر")
    } finally {
      setUploading(false)
    }
  }

  function cleanupCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  return (
    <>
      {value ? (
        <div className={cn("group relative w-full overflow-hidden rounded-lg border border-border", aspect)}>
          <Image src={value || "/placeholder.svg"} alt="پیش‌نمایش تصویر" fill className="object-cover" sizes="400px" />
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-background/60">
              <Loader2 className="h-6 w-6 animate-spin text-foreground" />
            </div>
          )}
          {/* Hover actions: replace / delete */}
          <div className="absolute inset-0 flex items-end justify-end gap-2 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md bg-background/90 px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-background"
            >
              <Replace className="h-3.5 w-3.5" />
              جایگزینی
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex items-center gap-1 rounded-md bg-background/90 px-2.5 py-1.5 text-xs font-semibold text-destructive shadow-sm transition hover:bg-background"
            >
              <X className="h-3.5 w-3.5" />
              حذف
            </button>
          </div>
        </div>
      ) : (
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
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) pickFile(f)
          e.target.value = ""
        }}
      />

      {cropSrc && (
        <ImageCropper
          src={cropSrc}
          aspect={ratio}
          cropShape={cropShape}
          onCancel={cleanupCrop}
          onCropped={async (blob) => {
            cleanupCrop()
            await uploadBlob(blob)
          }}
        />
      )}
    </>
  )
}
