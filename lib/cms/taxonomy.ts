import { prisma } from "@/lib/db"
import { ConflictError, NotFoundError } from "@/lib/core/errors"
import { slugify } from "@/lib/rich-content/render"

/** Category + tag helpers for content taxonomy. Categories are per-type. */

export async function listCategories(type: string) {
  return prisma.contentCategory.findMany({
    where: { type },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  })
}

export async function createCategory(input: {
  type: string
  name: string
  slug?: string
  parentId?: string | null
  order?: number
}) {
  const slug = slugify(input.slug || input.name) || "category"
  const clash = await prisma.contentCategory.findFirst({ where: { type: input.type, slug } })
  if (clash) throw new ConflictError("این نامک دسته قبلاً استفاده شده است")
  return prisma.contentCategory.create({
    data: {
      type: input.type,
      name: input.name.trim(),
      slug,
      parentId: input.parentId || null,
      order: input.order ?? 0,
    },
  })
}

export async function updateCategory(
  id: string,
  input: { name?: string; slug?: string; parentId?: string | null; order?: number },
) {
  const existing = await prisma.contentCategory.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("دسته یافت نشد")
  const data: { name?: string; slug?: string; parentId?: string | null; order?: number } = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.slug !== undefined) {
    const slug = slugify(input.slug) || existing.slug
    const clash = await prisma.contentCategory.findFirst({
      where: { type: existing.type, slug, id: { not: id } },
    })
    if (clash) throw new ConflictError("این نامک دسته قبلاً استفاده شده است")
    data.slug = slug
  }
  if (input.parentId !== undefined) data.parentId = input.parentId || null
  if (input.order !== undefined) data.order = input.order
  return prisma.contentCategory.update({ where: { id }, data })
}

export async function deleteCategory(id: string) {
  const existing = await prisma.contentCategory.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new NotFoundError("دسته یافت نشد")
  await prisma.contentCategory.delete({ where: { id } })
}

/** Find existing tags by id, and create any brand-new ones by name. */
export async function resolveTagIds(names: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const slug = slugify(name) || name
    const tag = await prisma.contentTag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    })
    ids.push(tag.id)
  }
  return ids
}

export async function listTags() {
  return prisma.contentTag.findMany({ orderBy: { name: "asc" }, take: 200 })
}
