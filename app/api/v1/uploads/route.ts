import { put } from "@vercel/blob"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { ValidationError } from "@/lib/core/errors"
import { rateLimitBy } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
const MAX_BYTES = 6 * 1024 * 1024 // 6 MB

/**
 * Folders that hold sensitive user documents (identity cards, payment
 * receipts, ticket attachments). These are stored as PRIVATE blobs — the raw
 * Blob URL is never usable without auth. Access goes through the
 * /api/v1/files proxy which enforces owner-or-admin authorization.
 * Everything else (admin-managed product/giveaway imagery rendered on the
 * public storefront) stays public.
 */
const PRIVATE_FOLDERS = new Set(["kyc", "tickets", "receipts", "uploads"])

/**
 * Authenticated file upload (KYC documents, ticket attachments, receipts and
 * admin product imagery). Sensitive folders are stored privately and returned
 * as a proxy URL; public imagery returns the direct Blob URL.
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
  const isPrivate = PRIVATE_FOLDERS.has(safeFolder.split("/")[0])

  // The user id prefix in the filename is what the download proxy uses to
  // authorize the owner — do not change this format without updating
  // app/api/v1/files/[...path]/route.ts.
  const blob = await put(`${safeFolder}/${user.id}-${Date.now()}.${ext}`, file, {
    access: isPrivate ? "private" : "public",
    addRandomSuffix: true,
    contentType: file.type,
  })

  const url = isPrivate ? `/api/v1/files/${blob.pathname}` : blob.url
  return { url, contentType: file.type }
})
