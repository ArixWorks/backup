import type { MediaKind } from "@prisma/client"

/**
 * Allow-list of MIME types accepted by the shared Media Library, grouped by the
 * MediaKind they map to. This is intentionally broad (documents, archives,
 * office files, code) because the Rich Content Editor supports attachment
 * cards for any of these, while still refusing executables and unknown types.
 */
export const MEDIA_MIME_KIND: Record<string, MediaKind> = {
  // images
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "IMAGE",
  "image/svg+xml": "IMAGE",
  "image/avif": "IMAGE",
  // video
  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
  "video/quicktime": "VIDEO",
  // audio
  "audio/mpeg": "AUDIO",
  "audio/ogg": "AUDIO",
  "audio/wav": "AUDIO",
  "audio/webm": "AUDIO",
  // documents
  "application/pdf": "DOCUMENT",
  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCUMENT",
  "application/vnd.ms-excel": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "DOCUMENT",
  "application/vnd.ms-powerpoint": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "DOCUMENT",
  "text/plain": "DOCUMENT",
  "text/markdown": "DOCUMENT",
  "application/json": "DOCUMENT",
  "application/xml": "DOCUMENT",
  "text/xml": "DOCUMENT",
  "text/csv": "DOCUMENT",
  // archives
  "application/zip": "ARCHIVE",
  "application/x-zip-compressed": "ARCHIVE",
  "application/x-rar-compressed": "ARCHIVE",
  "application/x-7z-compressed": "ARCHIVE",
  "application/gzip": "ARCHIVE",
}

export const MEDIA_MAX_BYTES = 50 * 1024 * 1024 // 50 MB

export function kindForMime(mime: string): MediaKind {
  return MEDIA_MIME_KIND[mime] ?? "OTHER"
}

export function isAllowedMedia(mime: string): boolean {
  return mime in MEDIA_MIME_KIND
}

/** Map a MediaKind to a human label used by attachment cards / filters. */
export function kindLabel(kind: MediaKind): string {
  switch (kind) {
    case "IMAGE":
      return "تصویر"
    case "VIDEO":
      return "ویدیو"
    case "AUDIO":
      return "صوت"
    case "DOCUMENT":
      return "سند"
    case "ARCHIVE":
      return "آرشیو"
    default:
      return "فایل"
  }
}

/** Human-readable file size. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`
}
