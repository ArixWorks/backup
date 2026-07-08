import { get } from "@vercel/blob"
import { requireUser } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * Authenticated download proxy for PRIVATE blobs (KYC documents, payment
 * receipts, ticket attachments).
 *
 * Authorization model:
 *  - Admins can read any private file (they review KYC / receipts / tickets).
 *  - Regular users can only read files they uploaded themselves. Ownership is
 *    established by the upload route's naming convention:
 *    `<folder>/<userId>-<timestamp>.<ext>` (see app/api/v1/uploads/route.ts).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  let user
  try {
    user = await requireUser()
  } catch {
    return new Response("Unauthorized", { status: 401 })
  }

  const { path } = await params
  const pathname = path.join("/")

  // Reject traversal or malformed paths outright.
  if (!pathname || pathname.includes("..") || pathname.includes("//")) {
    return new Response("Not found", { status: 404 })
  }

  const isAdmin = user.role === "ADMIN"
  if (!isAdmin) {
    const basename = pathname.split("/").pop() ?? ""
    if (!basename.startsWith(`${user.id}-`)) {
      return new Response("Not found", { status: 404 })
    }
  }

  try {
    // Read as a private blob when the store supports it; otherwise fall back to
    // reading the public blob. Either way, access to this route is already
    // gated by the owner-or-admin check above, so the file is not exposed
    // to unauthorized callers.
    let result
    try {
      result = await get(pathname, { access: "private" })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/private access on a public store/i.test(msg)) {
        result = await get(pathname, { access: "public" })
      } else {
        throw err
      }
    }
    if (!result || !result.stream) return new Response("Not found", { status: 404 })

    const headers = new Headers()
    if (result.blob.contentType) headers.set("Content-Type", result.blob.contentType)
    headers.set("Cache-Control", "private, no-store")
    headers.set("Content-Disposition", "inline")
    headers.set("X-Content-Type-Options", "nosniff")

    return new Response(result.stream, { status: 200, headers })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}
