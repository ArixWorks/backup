import { ApiError } from "@/lib/api-client"

/** Upload a file to the authenticated Blob upload route; returns its URL. */
export async function uploadFile(file: File, folder = "uploads"): Promise<string> {
  const form = new FormData()
  form.append("file", file)
  form.append("folder", folder)
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
  return json.data.url as string
}
