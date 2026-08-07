import "server-only"
import sharp from "sharp"
import { ValidationError } from "@/lib/core/errors"

/**
 * Server-side attachment hardening for the support ticket system.
 *
 * The browser's declared MIME type and the file extension are attacker
 * controlled and MUST NOT be trusted. This module verifies the *real* content
 * of every upload and, where possible, neutralizes it:
 *
 *  - IMAGE (jpeg/png/webp): the bytes are decoded and fully re-encoded with
 *    sharp. This strips EXIF/ICC/metadata and, crucially, destroys any content
 *    appended after the image data (polyglot files, e.g. a PNG that is also a
 *    valid HTML/JS or ZIP payload). If sharp cannot decode it, it is not a real
 *    image and is rejected. A pixel cap guards against decompression bombs.
 *  - PDF: must start with the %PDF- signature. We additionally reject PDFs that
 *    contain active-content markers (JavaScript, auto-actions, embedded files,
 *    launch actions). Stored bytes are served as an attachment with nosniff so
 *    the browser never executes them.
 *  - TEXT: must be valid UTF-8 with no NUL/binary control bytes.
 */

export type SafeAttachmentKind = "IMAGE" | "PDF" | "TEXT"

export interface SafeAttachment {
  kind: SafeAttachmentKind
  /** Sanitized bytes to persist (re-encoded for images, original for pdf/txt). */
  buffer: Buffer
  /** Canonical, verified MIME type — never the client-declared one. */
  mimeType: string
  /** Canonical file extension for the verified type. */
  ext: string
  /** Image dimensions, when kind === "IMAGE". */
  width?: number
  height?: number
}

export const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024 // 6 MB
/** Reject images larger than this decoded size (decompression-bomb guard). */
const MAX_IMAGE_PIXELS = 40_000_000 // 40 MP (~ 7746 x 5164)

function startsWith(buf: Buffer, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false
  for (let i = 0; i < sig.length; i++) if (buf[offset + i] !== sig[i]) return false
  return true
}

/** Sniff the true family from magic bytes, ignoring the client-declared type. */
function sniffKind(buf: Buffer): SafeAttachmentKind | null {
  // JPEG: FF D8 FF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "IMAGE"
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "IMAGE"
  // WebP: "RIFF" .... "WEBP"
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return "IMAGE"
  // PDF: %PDF- (may be preceded by a small BOM/whitespace in the wild, but we
  // require it at the very start for safety).
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "PDF"
  // No binary signature — candidate for UTF-8 text.
  if (looksLikeUtf8Text(buf)) return "TEXT"
  return null
}

/** True when the buffer is valid UTF-8 with no NUL or disallowed control bytes. */
function looksLikeUtf8Text(buf: Buffer): boolean {
  if (buf.length === 0) return false
  // Reject NUL and C0 control chars except TAB (09), LF (0a), CR (0d).
  for (const byte of buf) {
    if (byte === 0x00) return false
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) return false
  }
  // Strict UTF-8 round-trip: decoding must not introduce replacement chars.
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(buf)
    return !decoded.includes("\uFFFD")
  } catch {
    return false
  }
}

/** Active-content markers that make a PDF dangerous. Rejected outright. */
const PDF_DANGER = [/\/JavaScript/i, /\/JS\b/i, /\/Launch/i, /\/OpenAction/i, /\/AA\b/i, /\/EmbeddedFile/i, /\/RichMedia/i]

async function sanitizeImage(buf: Buffer): Promise<SafeAttachment> {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>
  try {
    meta = await sharp(buf, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "error" }).metadata()
  } catch {
    throw new ValidationError("فایل تصویری معتبر نیست")
  }
  const format = meta.format
  if (!format || !["jpeg", "png", "webp"].includes(format)) {
    throw new ValidationError("فقط تصویر JPG، PNG یا WebP مجاز است")
  }
  if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_IMAGE_PIXELS) {
    throw new ValidationError("ابعاد تصویر بیش از حد بزرگ است")
  }

  // Re-encode: rotate per EXIF then drop all metadata, producing clean bytes
  // with no trailing payload. Downscale very large images to a sane bound.
  const pipeline = sharp(buf, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "error" })
    .rotate()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })

  let out: Buffer
  let mimeType: string
  let ext: string
  if (format === "png") {
    out = await pipeline.png({ compressionLevel: 9 }).toBuffer()
    mimeType = "image/png"
    ext = "png"
  } else if (format === "webp") {
    out = await pipeline.webp({ quality: 82 }).toBuffer()
    mimeType = "image/webp"
    ext = "webp"
  } else {
    out = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    mimeType = "image/jpeg"
    ext = "jpg"
  }

  const outMeta = await sharp(out).metadata()
  return { kind: "IMAGE", buffer: out, mimeType, ext, width: outMeta.width, height: outMeta.height }
}

/**
 * Validate and sanitize an uploaded file, verifying its true content rather
 * than trusting the client-declared MIME type or extension.
 *
 * @param allowed Which kinds are permitted for this upload surface.
 */
export async function sanitizeUpload(
  file: File,
  allowed: SafeAttachmentKind[] = ["IMAGE", "PDF", "TEXT"],
): Promise<SafeAttachment> {
  if (file.size === 0) throw new ValidationError("فایل خالی است")
  if (file.size > MAX_ATTACHMENT_BYTES) throw new ValidationError("حجم فایل نباید بیشتر از ۶ مگابایت باشد")

  const buf = Buffer.from(await file.arrayBuffer())
  const kind = sniffKind(buf)
  if (!kind) throw new ValidationError("نوع فایل پشتیبانی نمی‌شود")
  if (!allowed.includes(kind)) throw new ValidationError("این نوع فایل مجاز نیست")

  if (kind === "IMAGE") return sanitizeImage(buf)

  if (kind === "PDF") {
    // Scan the raw bytes for active-content markers. Cheap, high-signal guard.
    const head = buf.toString("latin1")
    if (PDF_DANGER.some((re) => re.test(head))) {
      throw new ValidationError("این فایل PDF حاوی محتوای فعال (اسکریپت) است و پذیرفته نمی‌شود")
    }
    return { kind: "PDF", buffer: buf, mimeType: "application/pdf", ext: "pdf" }
  }

  // TEXT
  return { kind: "TEXT", buffer: buf, mimeType: "text/plain; charset=utf-8", ext: "txt" }
}
