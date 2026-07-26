import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { NotFoundError, ValidationError } from "@/lib/core/errors"

export async function listStoreCategories() {
  const categories = await prisma.productCategory.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          products: {
            where: { saleMode: "FIXED_PRICE", active: true, hidden: false },
          },
        },
      },
    },
  })
  return categories.map(({ _count, ...category }) => ({
    ...category,
    count: _count.products,
  }))
}

export async function getStoreCategory(slug: string) {
  const category = await prisma.productCategory.findFirst({
    where: { slug, active: true },
  })
  if (!category) throw new NotFoundError("دسته‌بندی پیدا نشد")
  return category
}

export async function listCategoriesAdmin() {
  const categories = await prisma.productCategory.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  })
  return categories.map(({ _count, ...category }) => ({ ...category, count: _count.products }))
}

type CategoryInput = {
  name: string
  slug: string
  description?: string | null
  icon?: string | null
  displayOrder?: number
  active?: boolean
}

export async function createProductCategory(input: CategoryInput, adminId: string) {
  const category = await prisma.productCategory.create({
    data: {
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      description: input.description?.trim() || null,
      icon: input.icon?.trim() || null,
      displayOrder: input.displayOrder ?? 0,
      active: input.active ?? true,
    },
  })
  await audit({ actorId: adminId, action: "PRODUCT_CATEGORY_CREATED", entity: "ProductCategory", entityId: category.id, meta: { name: category.name, slug: category.slug } })
  return category
}

export async function updateProductCategory(id: string, input: Partial<CategoryInput>, adminId: string) {
  const existing = await prisma.productCategory.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("دسته‌بندی پیدا نشد")
  const category = await prisma.productCategory.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug !== undefined ? { slug: input.slug.trim().toLowerCase() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.icon !== undefined ? { icon: input.icon?.trim() || null } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  })
  await audit({ actorId: adminId, action: "PRODUCT_CATEGORY_UPDATED", entity: "ProductCategory", entityId: id, meta: input })
  return category
}

export async function deleteProductCategory(id: string, adminId: string) {
  const existing = await prisma.productCategory.findUnique({ where: { id }, include: { _count: { select: { products: true } } } })
  if (!existing) throw new NotFoundError("دسته‌بندی پیدا نشد")
  await prisma.$transaction(async (tx) => {
    await tx.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } })
    await tx.productCategory.delete({ where: { id } })
    await audit({ actorId: adminId, action: "PRODUCT_CATEGORY_DELETED", entity: "ProductCategory", entityId: id, meta: { name: existing.name, detachedProducts: existing._count.products } }, tx)
  })
  return { deleted: true }
}

export async function assertCategory(categoryId?: string | null) {
  if (!categoryId) return null
  const category = await prisma.productCategory.findUnique({ where: { id: categoryId } })
  if (!category) throw new ValidationError("دسته‌بندی انتخاب‌شده معتبر نیست")
  return category
}
