import { ApiError } from "@/lib/api-client"

export type UploadKind = "IMAGE" | "PDF" | "TEXT"

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
  const form = new FormData()
  form.append("file", file)
  form.append("folder", folder)
  form.append("accept", accept.map((k) => k.toLowerCase()).join(","))
  const res = await fetch("/api/v1/uploads", {
    method: "POST",
    credentials: "include",
    body: form,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
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
