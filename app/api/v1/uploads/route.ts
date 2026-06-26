import { put } from "@vercel/blob"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { ValidationError } from "@/lib/core/errors"
import { rateLimitBy } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const MAX_BYTES = 6 * 1024 * 1024 // 6 MB

/**
 * Authenticated file upload (KYC documents, ticket attachments). Stores into
 * the public Blob store with a random suffix so the URL is unguessable. Returns
 * the stable Blob URL for persistence on the related record.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser()
  // Cap uploads per user to prevent Blob-storage abuse.
  await rateLimitBy(user.id, { bucket: "uploads", limit: 30, windowSec: 600 })
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) throw new ValidationError("فایلی ارسال نشده است")
  if (!ALLOWED.includes(file.type)) throw new ValidationError("فقط تصویر (JPG/PNG/WebP) یا PDF مجاز است")
  if (file.size > MAX_BYTES) throw new ValidationError("حجم فایل نباید بیشتر از ۶ مگابایت باشد")

  const folder = (form.get("folder") as string | null) || "uploads"
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "")
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1] || "bin"

  const blob = await put(`${safeFolder}/${user.id}-${Date.now()}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  })

  return { url: blob.url, contentType: file.type }
})
