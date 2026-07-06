import Image, { type ImageProps } from "next/image"
import { cn } from "@/lib/utils"

/**
 * Project-wide responsive image.
 *
 * Wraps next/image so every image gets the right behavior by default:
 *  - modern formats (AVIF → WebP → original) via the optimizer configured in
 *    next.config (`formats` + deviceSizes/imageSizes) → automatic srcset.
 *  - a required, explicit `sizes` so the browser downloads the smallest source
 *    that fits the slot (no oversized downloads on mobile).
 *  - lazy loading by default; opt into `priority` only for above-the-fold hero
 *    images (LCP) — passing `priority` disables lazy automatically.
 *  - an optional blur placeholder to avoid a blank flash while loading.
 *  - a wrapper that RESERVES the aspect ratio so the layout never shifts (CLS)
 *    while the image downloads.
 *
 * Use `fill` for responsive art-directed slots (default here); pass explicit
 * width/height only for fixed-size icons/logos.
 */
type ResponsiveImageProps = Omit<ImageProps, "sizes"> & {
  /** REQUIRED: the rendered slot size across breakpoints. */
  sizes: string
  /** Aspect ratio for the reserved box, e.g. "16/9", "1/1", "4/3". */
  ratio?: string
  /** Extra classes on the reserving wrapper. */
  wrapperClassName?: string
  /** Rounded corners preset applied to wrapper + image. */
  rounded?: string
}

export function ResponsiveImage({
  ratio = "16/9",
  wrapperClassName,
  rounded = "rounded-xl",
  className,
  fill,
  width,
  height,
  alt,
  ...props
}: ResponsiveImageProps) {
  // Fixed-dimension images (icons/logos) don't reserve via aspect-ratio.
  const isFixed = width != null && height != null && !fill
  if (isFixed) {
    return (
      <Image
        alt={alt}
        width={width}
        height={height}
        className={cn(rounded, className)}
        {...props}
      />
    )
  }

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-muted/40", rounded, wrapperClassName)}
      style={{ aspectRatio: ratio }}
    >
      <Image
        alt={alt}
        fill
        className={cn("object-cover", className)}
        {...props}
      />
    </div>
  )
}
