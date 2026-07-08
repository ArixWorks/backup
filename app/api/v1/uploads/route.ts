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
 * Whether the connected Blob store supports private access. Probed lazily on
 * the first sensitive upload and cached for the lifetime of the server:
 *  - `true`  → store is private-capable, we use real private blobs.
 *  - `false` → store is public-only; we fall back to public blobs but still
 *              gate access behind the /api/v1/files proxy (owner-or-admin),
 *              and never expose the raw Blob URL to the client.
 *  - `null`  → not yet probed.
 * Provisioning a private-access Blob store is recommended for the strongest
 * privacy on sensitive documents; this fallback keeps uploads working either way.
 */
let storeSupportsPrivate: boolean | null = null

function isPublicStoreError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /private access on a public store/i.test(msg)
}

/**
 * Authenticated file upload (KYC documents, ticket attachments, receipts and
 * admin product imagery). Sensitive folders are stored privately (or public
 * behind the auth proxy when the store lacks private access) and returned as a
 * proxy URL; public imagery returns the direct Blob URL.
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
  const key = `${safeFolder}/${user.id}-${Date.now()}.${ext}`

  // Sensitive folders want private blobs. If the store is public-only, fall
  // back to a public blob transparently (still gated by the /api/v1/files
  // proxy). The store capability is probed once and cached.
  const wantPrivate = isPrivate && storeSupportsPrivate !== false
  let blob
  try {
    blob = await put(key, file, {
      access: wantPrivate ? "private" : "public",
      addRandomSuffix: true,
      contentType: file.type,
    })
    if (wantPrivate) storeSupportsPrivate = true
  } catch (err) {
    if (wantPrivate && isPublicStoreError(err)) {
      storeSupportsPrivate = false
      blob = await put(key, file, {
        access: "public",
        addRandomSuffix: true,
        contentType: file.type,
      })
    } else {
      throw err
    }
  }

  // Sensitive files are always served through the auth proxy so their raw
  // (possibly public) Blob URL is never handed to the client; public imagery
  // is returned directly.
  const url = isPrivate ? `/api/v1/files/${blob.pathname}` : blob.url
  return { url, contentType: file.type }
})
