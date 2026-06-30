"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { DragScroll } from "@/components/ui/drag-scroll"

/**
 * Image gallery for the product detail page: a large primary image with a
 * row of selectable thumbnails. Falls back to a placeholder when no images.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const list = images.length > 0 ? images : ["/placeholder.svg"]
  const [active, setActive] = useState(0)
  const current = list[Math.min(active, list.length - 1)]

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-muted">
        <Image
          src={current || "/placeholder.svg"}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>
      {list.length > 1 && (
        <DragScroll>
          {list.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
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
