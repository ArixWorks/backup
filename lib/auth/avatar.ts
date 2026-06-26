import "server-only"
import { put } from "@vercel/blob"
import { prisma } from "@/lib/db"

/**
 * Telegram photo URLs (from the Login Widget `photo_url` or Mini App initData)
 * are short-lived and can be CORS-restricted. We mirror the image into Blob
 * once so the app always has a stable, fast avatar URL.
 *
 * Best-effort: any failure just leaves the existing avatar untouched.
 */
export async function cacheTelegramAvatar(opts: {
  userId: string
  telegramId: string
  photoUrl?: string | null
  /** Re-download even if we already have a cached copy. */
  force?: boolean
}): Promise<string | null> {
  const { userId, telegramId, photoUrl, force } = opts
  if (!photoUrl) return null

  try {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { photoUrl: true },
    })
    // Already mirrored to Blob and not forced — keep it.
    if (!force && existing?.photoUrl && existing.photoUrl.includes("blob.vercel-storage.com")) {
      return existing.photoUrl
    }

    const res = await fetch(photoUrl)
    if (!res.ok) return existing?.photoUrl ?? null
    const contentType = res.headers.get("content-type") || "image/jpeg"
    const ext = contentType.includes("png") ? "png" : "jpg"
    const bytes = await res.arrayBuffer()

    const blob = await put(`avatars/${telegramId}.${ext}`, Buffer.from(bytes), {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    await prisma.user.update({ where: { id: userId }, data: { photoUrl: blob.url } })
    return blob.url
  } catch (e) {
    console.log("[v0] cacheTelegramAvatar error:", (e as Error).message)
    return null
  }
}
