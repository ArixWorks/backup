"use client"

import { useState } from "react"
import Image from "next/image"
import { ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { DragScroll } from "@/components/ui/drag-scroll"

/**
 * Image gallery for the product detail page: a large primary image with a
 * row of selectable thumbnails. Falls back to a placeholder when no images.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const list = images.filter(Boolean)
  const [active, setActive] = useState(0)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const current = list[Math.min(active, Math.max(list.length - 1, 0))]
  const showFallback = !current || failedSrc === current

  function selectImage(index: number) {
    setActive(index)
    setFailedSrc(null)
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-muted">
        {showFallback ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <ImageOff className="h-9 w-9" aria-hidden="true" />
            <span className="text-xs">{alt}</span>
          </div>
        ) : (
          <Image
            src={current}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
            onError={() => setFailedSrc(current)}
          />
        )}
      </div>
      {list.length > 1 && (
        <DragScroll>
          {list.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectImage(i)}
              aria-label={`${alt} ${i + 1}`}
              className={cn(
                "relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Image
                src={src || "/placeholder.svg"}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </DragScroll>
      )}
    </div>
  )
}
