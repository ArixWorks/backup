/**
 * Client-side image downscaling + re-encoding, run before an attachment is
 * uploaded.
 *
 * Why this exists:
 *  - Vercel Functions reject any request body over ~4.5 MB before our route
 *    handler runs, so a raw phone photo (commonly 3–10 MB) fails in production
 *    with an opaque platform HTML page. Shrinking the image in the browser
 *    keeps the transported bytes comfortably under that ceiling.
 *  - iPhones hand us HEIC/HEIF files that the server's `sharp` pipeline used to
 *    reject outright. WebKit can decode HEIC into an <img>/canvas, so drawing
 *    it and re-encoding to JPEG converts it to a universally accepted format on
 *    the device itself.
 *
 * This is a best-effort optimisation, never a gate: if the browser cannot
 * decode the file (e.g. desktop HEIC, or a non-image), the ORIGINAL file is
 * returned unchanged and the server remains the authoritative validator.
 */

export interface CompressOptions {
  /** Longest edge of the output image, in pixels. */
  maxDimension?: number
  /** Target byte size; quality is stepped down until the output fits. */
  targetBytes?: number
  /** Lowest JPEG quality we will drop to while chasing `targetBytes`. */
  minQuality?: number
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 2560,
  // Stay well under Vercel's ~4.5 MB function body limit after multipart
  // overhead — a healthy margin so re-encoding on the server never tips over.
  targetBytes: 3.5 * 1024 * 1024,
  minQuality: 0.5,
}

/** True for anything we should try to decode as an image (incl. HEIC/HEIF). */
function isCompressibleImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  // iOS sometimes reports an empty type for HEIC; fall back to the extension.
  return /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)
}

/** Decode a File into something drawable, applying EXIF orientation. */
async function decode(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void } | null> {
  // Prefer createImageBitmap: it is fast and can bake in EXIF orientation.
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions)
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      }
    } catch {
      // Fall through to the <img> path (better HEIC support on Safari).
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("decode failed"))
      el.src = url
    })
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality))
}

/**
 * Return a compressed JPEG `File` for the given image, or the original file
 * unchanged when compression is not possible or would not help.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  // Only run in the browser and only for decodable images.
  if (typeof document === "undefined" || !isCompressibleImage(file)) return file

  const { maxDimension, targetBytes, minQuality } = { ...DEFAULTS, ...options }

  const decoded = await decode(file)
  if (!decoded || !decoded.width || !decoded.height) return file

  const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height))
  const width = Math.max(1, Math.round(decoded.width * scale))
  const height = Math.max(1, Math.round(decoded.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return file
  // White matte so transparent PNGs don't turn black when flattened to JPEG.
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)
  decoded.draw(ctx, width, height)

  // Step the quality down until the encoded size fits the target.
  let best: Blob | null = null
  for (const quality of [0.85, 0.75, 0.65, minQuality]) {
    const blob = await canvasToBlob(canvas, quality)
    if (!blob) break
    best = blob
    if (blob.size <= targetBytes) break
  }
  if (!best) return file

  // If we somehow made it bigger (tiny already-optimised image), keep original.
  if (best.size >= file.size) return file

  const baseName = file.name.replace(/\.[^.]*$/, "") || "image"
  return new File([best], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() })
}
