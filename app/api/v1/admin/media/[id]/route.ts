import { del } from "@vercel/blob"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { NotFoundError } from "@/lib/core/errors"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

/** Update media metadata (rename, alt, caption, tags, folder). */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const body = (await req.json()) as {
    filename?: string
    alt?: string | null
    caption?: string | null
    tags?: string[]
    folderId?: string | null
  }
  const existing = await prisma.mediaAsset.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("فایل یافت نشد")

  const asset = await prisma.mediaAsset.update({
    where: { id },
    data: {
      filename: body.filename ?? undefined,
      alt: body.alt === undefined ? undefined : body.alt,
      caption: body.caption === undefined ? undefined : body.caption,
      tags: body.tags ?? undefined,
      folderId: body.folderId === undefined ? undefined : body.folderId,
    },
  })
  return asset
})

/** Delete a media asset from both the index and Blob storage. */
export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const asset = await prisma.mediaAsset.findUnique({ where: { id } })
  if (!asset) throw new NotFoundError("فایل یافت نشد")

  // Best-effort blob deletion; the DB record is the source of truth.
  try {
    await del(asset.url)
  } catch (err) {
    console.log("[v0] media blob delete failed:", err)
  }
  await prisma.mediaAsset.delete({ where: { id } })
  return { deleted: true }
})
