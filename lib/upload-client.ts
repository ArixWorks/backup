import { ApiError } from "@/lib/api-client"

export type UploadKind = "IMAGE" | "PDF" | "TEXT"

/**
 * Maximum attachment size accepted by the upload route.
 *
 * Vercel Functions reject any request whose body exceeds ~4.5 MB *before* the
 * route handler runs, responding with an HTML error page (not JSON). A file
 * between 4.5 MB and the old 6 MB cap therefore produced the cryptic
 * "Unexpected token '<'" crash in production. We cap at 4 MB to stay safely
 * under that platform limit (multipart overhead is negligible), and the server
 * validator enforces the same ceiling as the final gate.
 */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024 // 4 MB
export const MAX_ATTACHMENT_LABEL = "۴ مگابایت"

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
  // Guard the size on the client before spending a round-trip. Files over the
  // platform body limit would otherwise be rejected with an HTML page.
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ApiError(
      `«${file.name}» بیش از حد بزرگ است. حداکثر حجم مجاز ${MAX_ATTACHMENT_LABEL} است.`,
      "FILE_TOO_LARGE",
      413,
    )
  }

  const form = new FormData()
  form.append("file", file)
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
