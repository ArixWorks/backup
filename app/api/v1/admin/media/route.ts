import { put } from "@vercel/blob"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { ValidationError } from "@/lib/core/errors"
import { prisma } from "@/lib/db"
import { isAllowedMedia, kindForMime, MEDIA_MAX_BYTES } from "@/lib/rich-content/media"
import type { Prisma, MediaKind } from "@prisma/client"

export const dynamic = "force-dynamic"

/**
 * Shared Media Library listing. Supports search (filename/alt/caption/tags),
 * kind filter, folder filter, "unused" filter (assets referenced by nothing),
 * and sorting. Powers the Media Manager dialog inside the Rich Content Editor.
 */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const q = url.searchParams.get("q")?.trim()
  const kind = url.searchParams.get("kind") as MediaKind | null
  const folderId = url.searchParams.get("folderId")
  const sort = url.searchParams.get("sort") ?? "recent"
  const take = Math.min(Number(url.searchParams.get("take") ?? 60), 120)
  const cursor = url.searchParams.get("cursor")

  const where: Prisma.MediaAssetWhereInput = {}
  if (kind) where.kind = kind
  if (folderId === "none") where.folderId = null
  else if (folderId) where.folderId = folderId
  if (q) {
    where.OR = [
      { filename: { contains: q, mode: "insensitive" } },
      { alt: { contains: q, mode: "insensitive" } },
      { caption: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
    ]
  }

  const orderBy: Prisma.MediaAssetOrderByWithRelationInput =
    sort === "name"
      ? { filename: "asc" }
      : sort === "size"
        ? { size: "desc" }
        : { createdAt: "desc" }

  const assets = await prisma.mediaAsset.findMany({
    where,
    orderBy,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = assets.length > take
  const items = hasMore ? assets.slice(0, take) : assets
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null }
})

/**
 * Upload a new file to the Media Library. Stored as a public Blob (library
 * media is admin-managed content rendered on the public storefront) and
 * indexed in MediaAsset for reuse.
 */
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) throw new ValidationError("فایلی ارسال نشده است")
  if (!isAllowedMedia(file.type)) throw new ValidationError("این نوع فایل مجاز نیست")
  if (file.size > MEDIA_MAX_BYTES) throw new ValidationError("حجم فایل نباید بیشتر از ۵۰ مگابایت باشد")

  const folderId = (form.get("folderId") as string | null) || null
  const alt = (form.get("alt") as string | null) || null
  const caption = (form.get("caption") as string | null) || null
  const blurDataUrl = (form.get("blurDataUrl") as string | null) || null
  const width = form.get("width") ? Number(form.get("width")) : null
  const height = form.get("height") ? Number(form.get("height")) : null

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin"
  const blob = await put(`media/${Date.now()}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  })

  const asset = await prisma.mediaAsset.create({
    data: {
      url: blob.url,
      pathname: blob.pathname,
      kind: kindForMime(file.type),
      mimeType: file.type,
      filename: file.name,
      size: file.size,
      width,
      height,
      blurDataUrl,
      alt,
      caption,
      folderId,
      uploadedById: admin.id,
    },
  })
  return asset
})
