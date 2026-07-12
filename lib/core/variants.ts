import "server-only"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { NotFoundError, ValidationError } from "@/lib/core/errors"

/**
 * Sale plans (product variants) management.
 *
 * A FIXED_PRICE product exposes one or more purchasable plans. Each plan owns
 * its own price / stock / delivery / inventory pool, so instead of the admin
 * creating separate confusing products (e.g. "Windscribe 1-device" and
 * "Windscribe full"), one product holds several plans and the customer picks.
 *
 * Stock/soldCount are mutated by the purchase engine (flash-sale.ts); here we
 * only manage plan definitions + admin-set stock. All money is BigInt (Toman).
 */

export interface PlanAttributes {
  duration?: string | null
  devices?: number | null
  accountType?: "shared" | "private" | null
  credentialsControl?: boolean | null
  twoFactor?: boolean | null
  warranty?: string | null
  [key: string]: string | number | boolean | null | undefined
}

export interface VariantInput {
  name: string
  attributes?: PlanAttributes | null
  description?: string | null
  i18n?: Record<string, unknown> | null
  price: bigint
  compareAtPrice?: bigint | null
  stock?: number
  purchaseLimit?: number | null
  deliveryType?: "MANUAL" | "AUTOMATIC"
  displayOrder?: number
  active?: boolean
}

function serialize<T extends { price: bigint; compareAtPrice: bigint | null }>(v: T) {
  return { ...v, price: v.price.toString(), compareAtPrice: v.compareAtPrice?.toString() ?? null }
}

/** List all plans of a product (admin view), ordered for display. */
export async function listVariants(productId: string) {
  const rows = await prisma.productVariant.findMany({
    where: { productId },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  })
  return rows.map(serialize)
}

async function assertFixedProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, saleMode: true, deliveryType: true },
  })
  if (!product) throw new NotFoundError("محصول یافت نشد")
  if (product.saleMode !== "FIXED_PRICE") {
    throw new ValidationError("پلن فروش فقط برای محصولات قیمت‌ثابت قابل تعریف است")
  }
  return product
}

/** Create a new sale plan for a product. */
export async function createVariant(productId: string, input: VariantInput, adminId: string) {
  const product = await assertFixedProduct(productId)
  if (!input.name?.trim()) throw new ValidationError("نام پلن الزامی است")
  if (input.price < 0n) throw new ValidationError("قیمت نامعتبر است")

  const count = await prisma.productVariant.count({ where: { productId } })
  const created = await prisma.productVariant.create({
    data: {
      productId,
      name: input.name.trim(),
      attributes: (input.attributes ?? undefined) as never,
      description: input.description ?? null,
      i18n: (input.i18n ?? undefined) as never,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      stock: input.stock ?? 0,
      purchaseLimit: input.purchaseLimit ?? null,
      deliveryType: input.deliveryType ?? product.deliveryType,
      displayOrder: input.displayOrder ?? count,
      active: input.active ?? true,
    },
  })
  await audit({ actorId: adminId, action: "variant.create", entity: "product", entityId: productId, meta: { variantId: created.id } })
  return serialize(created)
}

/** Update an existing plan. Only provided fields change. */
export async function updateVariant(variantId: string, input: Partial<VariantInput>, adminId: string) {
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } })
  if (!existing) throw new NotFoundError("پلن یافت نشد")
  if (input.name !== undefined && !input.name.trim()) throw new ValidationError("نام پلن الزامی است")
  if (input.price !== undefined && input.price < 0n) throw new ValidationError("قیمت نامعتبر است")

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: {
      name: input.name?.trim(),
      attributes: input.attributes !== undefined ? ((input.attributes ?? undefined) as never) : undefined,
      description: input.description !== undefined ? input.description : undefined,
      i18n: input.i18n !== undefined ? ((input.i18n ?? undefined) as never) : undefined,
      price: input.price,
      compareAtPrice: input.compareAtPrice !== undefined ? input.compareAtPrice : undefined,
      stock: input.stock,
      purchaseLimit: input.purchaseLimit !== undefined ? input.purchaseLimit : undefined,
      deliveryType: input.deliveryType,
      displayOrder: input.displayOrder,
      active: input.active,
    },
  })
  await audit({ actorId: adminId, action: "variant.update", entity: "product", entityId: existing.productId, meta: { variantId } })
  return serialize(updated)
}

/**
 * Delete a plan. Blocked when it has orders (preserve history) — deactivate
 * instead. Its inventory pool cascades away with the row.
 */
export async function deleteVariant(variantId: string, adminId: string) {
  const existing = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, productId: true, _count: { select: { orders: true } } },
  })
  if (!existing) throw new NotFoundError("پلن یافت نشد")
  if (existing._count.orders > 0) {
    throw new ValidationError("این پلن سفارش ثبت‌شده دارد؛ به‌جای حذف آن را غیرفعال کنید")
  }
  await prisma.productVariant.delete({ where: { id: variantId } })
  await audit({ actorId: adminId, action: "variant.delete", entity: "product", entityId: existing.productId, meta: { variantId } })
  return { ok: true }
}

/** Persist a new display order for a product's plans. */
export async function reorderVariants(productId: string, orderedIds: string[], adminId: string) {
  await assertFixedProduct(productId)
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.productVariant.updateMany({ where: { id, productId }, data: { displayOrder: index } }),
    ),
  )
  await audit({ actorId: adminId, action: "variant.reorder", entity: "product", entityId: productId })
  return { ok: true }
}
