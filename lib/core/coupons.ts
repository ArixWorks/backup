import type { Prisma, Coupon } from "@prisma/client"
import { prisma } from "@/lib/db"
import { NotFoundError, ValidationError } from "./errors"
import { tehranInputToUtc } from "@/lib/format"

type Tx = Prisma.TransactionClient | typeof prisma

export interface DiscountPreview {
  discount: bigint
  finalTotal: bigint
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

/** Pure discount computation given a coupon and an order subtotal. */
export function computeDiscount(coupon: Coupon, subtotal: bigint): bigint {
  let discount: bigint
  if (coupon.type === "PERCENT") {
    discount = (subtotal * coupon.value) / 100n
    if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount
  } else {
    discount = coupon.value
  }
  if (discount > subtotal) discount = subtotal
  if (discount < 0n) discount = 0n
  return discount
}

/**
 * Validate a coupon against an order for a given user and return the discount.
 * Throws ValidationError (carrying an i18n code as the message) on any rule
 * violation. Reuse inside the purchase transaction so checks are atomic.
 */
export async function evaluateCoupon(
  db: Tx,
  code: string,
  subtotal: bigint,
  userId: string,
): Promise<{ couponId: string; preview: DiscountPreview }> {
  const coupon = await db.coupon.findUnique({ where: { code: normalizeCode(code) } })
  if (!coupon || !coupon.active) throw new ValidationError("coupon.invalid")

  const now = new Date()
  if (coupon.startsAt && coupon.startsAt > now) throw new ValidationError("coupon.notStarted")
  if (coupon.expiresAt && coupon.expiresAt < now) throw new ValidationError("coupon.expired")
  if (subtotal < coupon.minOrder) throw new ValidationError("coupon.minOrder")
  if (coupon.totalLimit !== null && coupon.usedCount >= coupon.totalLimit) {
    throw new ValidationError("coupon.exhausted")
  }
  if (coupon.perUserLimit !== null) {
    const used = await db.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    })
    if (used >= coupon.perUserLimit) throw new ValidationError("coupon.userLimit")
  }

  const discount = computeDiscount(coupon, subtotal)
  if (discount <= 0n) throw new ValidationError("coupon.invalid")

  return { couponId: coupon.id, preview: { discount, finalTotal: subtotal - discount } }
}

/** Record a redemption and bump the coupon's usage counter (in-transaction). */
export async function redeemCoupon(
  db: Tx,
  couponId: string,
  userId: string,
  orderId: string,
  amount: bigint,
): Promise<void> {
  await db.couponRedemption.create({
    data: { couponId, userId, orderId, amount },
  })
  await db.coupon.update({
    where: { id: couponId },
    data: { usedCount: { increment: 1 } },
  })
}

// --- Admin CRUD --------------------------------------------------------------

export interface CouponInput {
  code: string
  type: "PERCENT" | "FIXED"
  value: number
  maxDiscount?: number | null
  minOrder?: number
  perUserLimit?: number | null
  totalLimit?: number | null
  active?: boolean
  startsAt?: string | null
  expiresAt?: string | null
}

function validateInput(input: CouponInput) {
  if (input.type === "PERCENT" && (input.value < 1 || input.value > 100)) {
    throw new ValidationError("Percentage must be between 1 and 100")
  }
  if (input.value <= 0) throw new ValidationError("Value must be positive")
}

export async function createCoupon(input: CouponInput) {
  validateInput(input)
  return prisma.coupon.create({
    data: {
      code: normalizeCode(input.code),
      type: input.type,
      value: BigInt(Math.round(input.value)),
      maxDiscount: input.maxDiscount ? BigInt(Math.round(input.maxDiscount)) : null,
      minOrder: BigInt(Math.round(input.minOrder ?? 0)),
      perUserLimit: input.perUserLimit ?? null,
      totalLimit: input.totalLimit ?? null,
      active: input.active ?? true,
      startsAt: input.startsAt ? tehranInputToUtc(input.startsAt) : null,
      expiresAt: input.expiresAt ? tehranInputToUtc(input.expiresAt) : null,
    },
  })
}

export async function updateCoupon(id: string, input: Partial<CouponInput>) {
  const existing = await prisma.coupon.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("Coupon not found")

  const data: Prisma.CouponUpdateInput = {}
  if (input.code !== undefined) data.code = normalizeCode(input.code)
  if (input.type !== undefined) data.type = input.type
  if (input.value !== undefined) data.value = BigInt(Math.round(input.value))
  if (input.maxDiscount !== undefined)
    data.maxDiscount = input.maxDiscount ? BigInt(Math.round(input.maxDiscount)) : null
  if (input.minOrder !== undefined) data.minOrder = BigInt(Math.round(input.minOrder))
  if (input.perUserLimit !== undefined) data.perUserLimit = input.perUserLimit
  if (input.totalLimit !== undefined) data.totalLimit = input.totalLimit
  if (input.active !== undefined) data.active = input.active
  if (input.startsAt !== undefined) data.startsAt = input.startsAt ? tehranInputToUtc(input.startsAt) : null
  if (input.expiresAt !== undefined)
    data.expiresAt = input.expiresAt ? tehranInputToUtc(input.expiresAt) : null

  return prisma.coupon.update({ where: { id }, data })
}

export async function deleteCoupon(id: string) {
  await prisma.coupon.delete({ where: { id } })
}

export async function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } })
}
