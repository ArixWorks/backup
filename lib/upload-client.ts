import { ApiError } from "@/lib/api-client"
import { compressImage } from "@/lib/upload/compress-image"

export type UploadKind = "IMAGE" | "PDF" | "TEXT"

/**
 * Largest file a user may *select*. Images this large are re-encoded and
 * shrunk in the browser before upload (see `MAX_TRANSPORT_BYTES`), so a 10 MB
 * phone photo is accepted and transported as a much smaller JPEG.
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_ATTACHMENT_LABEL = "۱۰ مگابایت"

/**
 * Largest body we will actually send over the wire. Vercel Functions reject
 * any request whose body exceeds ~4.5 MB *before* the route handler runs,
 * responding with an HTML error page (not JSON) — the classic
 * "Unexpected token '<'" crash. Images are compressed under this ceiling
 * client-side; non-image files (PDF/text) can't be compressed, so anything
 * still over the limit is rejected here with a clear message instead.
 */
export const MAX_TRANSPORT_BYTES = 4 * 1024 * 1024 // 4 MB
const MAX_TRANSPORT_LABEL = "۴ مگابایت"

/** Full, server-verified attachment descriptor returned by the upload route. */
export interface UploadedAttachment {
  url: string
  kind: UploadKind
  name: string
  mimeType: string
  size: number
  width: number | null
  height: number | null
}

/**
 * Upload a file to the authenticated Blob upload route and return the full
 * server-verified descriptor (URL + kind + name + size + dimensions).
 *
 * `accept` controls which families the server will accept. Ticket attachments
 * pass `["IMAGE","PDF","TEXT"]`; other flows keep the stricter default.
 */
export async function uploadAttachment(
  file: File,
  folder = "uploads",
  accept: UploadKind[] = ["IMAGE", "PDF"],
): Promise<UploadedAttachment> {
  // Guard the selection size first so we never waste work on absurd files.
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ApiError(
      `«${file.name}» بیش از حد بزرگ است. حداکثر حجم مجاز ${MAX_ATTACHMENT_LABEL} است.`,
      "FILE_TOO_LARGE",
      413,
    )
  }

  // Shrink/normalise images in the browser (also converts HEIC → JPEG) so the
  // transported body stays under the platform limit. Non-images pass through.
  const prepared = await compressImage(file)

  // Final transport gate: images are now small, but an oversized PDF/text file
  // can't be compressed — reject it clearly rather than let the platform return
  // an opaque HTML error page mid-upload.
  if (prepared.size > MAX_TRANSPORT_BYTES) {
    throw new ApiError(
      `«${file.name}» بیش از حد بزرگ است. حداکثر حجم مجاز برای این نوع فایل ${MAX_TRANSPORT_LABEL} است.`,
      "FILE_TOO_LARGE",
      413,
    )
  }

  const form = new FormData()
  form.append("file", prepared)
  form.append("folder", folder)
  form.append("accept", accept.map((k) => k.toLowerCase()).join(","))
  const res = await fetch("/api/v1/uploads", {
    method: "POST",
    credentials: "include",
    body: form,
  })

  // The upload route returns JSON, but an oversized body (413), an auth wall,
  // or a proxy/5xx page can return HTML. Parse defensively so the user sees a
  // meaningful message instead of a raw "Unexpected token '<'" JSON crash.
  const text = await res.text()
  let json: any = {}
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      const message =
        res.status === 413
          ? `فایل بیش از حد بزرگ است. حداکثر حجم مجاز ${MAX_ATTACHMENT_LABEL} است.`
          : res.status === 401 || res.status === 403
            ? "نشست شما منقضی شده یا دسترسی ندارید. لطفاً دوباره وارد شوید."
            : res.status >= 500
              ? "خطای سرور هنگام بارگذاری فایل. لطفاً کمی بعد دوباره تلاش کنید."
              : "بارگذاری فایل ناموفق بود. لطفاً فایلی کوچک‌تر انتخاب کنید یا دوباره تلاش کنید."
      throw new ApiError(message, "UPLOAD_INVALID_RESPONSE", res.status || 0)
    }
  }
  if (!res.ok) {
    throw new ApiError(json?.error?.message ?? "خطا در بارگذاری فایل", json?.error?.code ?? "UPLOAD", res.status)
  }
  return json.data as UploadedAttachment
}

/** Legacy helper: upload a file and return only its URL. */
export async function uploadFile(file: File, folder = "uploads"): Promise<string> {
  const { url } = await uploadAttachment(file, folder)
  return url
}
