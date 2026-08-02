import { prisma } from "@/lib/db"
import type { OrderPaymentReport } from "@/lib/orders/shared"

export type { OrderPaymentReport }

/**
 * Accurate, serializable payment report for a single shop/auction order.
 *
 * Amounts are plain numbers in Toman (IRT minor units == whole Toman here), safe
 * within JS integer range for this platform's price ceilings. All fields are
 * derived from immutable records:
 *   - net paid              → order.amount (the only refundable principal)
 *   - original / discount   → order snapshot columns, else derived from the
 *                             coupon redemption (legacy orders)
 *   - coupon code           → CouponRedemption → Coupon.code
 *   - cashback / commission → WalletTransaction rows tagged refType='order'
 *
 * Pure read; performs no writes.
 */
function toNum(v: bigint | number | null | undefined): number {
  if (v == null) return 0
  return typeof v === "bigint" ? Number(v) : v
}

export async function getOrderPaymentReport(orderId: string): Promise<OrderPaymentReport | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, amount: true, originalAmount: true, discountAmount: true, discountKind: true },
  })
  if (!order) return null

  // Coupon redemption (unique per order) → discount amount + code.
  const redemption = await prisma.couponRedemption.findUnique({
    where: { orderId },
    select: { amount: true, coupon: { select: { code: true } } },
  })
  const couponCode = redemption?.coupon?.code ?? null
  const couponDiscount = toNum(redemption?.amount)

  const net = toNum(order.amount)

  // Prefer the snapshot; fall back to reconstructing from the redemption so
  // legacy orders (created before the snapshot columns existed) still report.
  const snapshotOriginal = toNum(order.originalAmount)
  const snapshotDiscount = toNum(order.discountAmount)
  const hasSnapshot = order.originalAmount != null

  let originalAmount: number
  let discountAmount: number
  let discountKind: string | null
  let derived = false

  if (hasSnapshot) {
    originalAmount = snapshotOriginal
    discountAmount = snapshotDiscount
    discountKind = order.discountKind ?? (snapshotDiscount > 0 ? (couponCode ? "COUPON" : "TIER") : null)
  } else {
    // Legacy: the only discount we can prove is a recorded coupon redemption.
    discountAmount = couponDiscount
    originalAmount = net + couponDiscount
    discountKind = couponDiscount > 0 ? "COUPON" : null
    derived = true
  }

  const discountPercent = originalAmount > 0 ? Math.round((discountAmount / originalAmount) * 100) : 0

  // Wallet side effects tagged to this order: cashback to the buyer and any
  // referral commission paid out. Sum by type (amounts are signed deltas).
  const txns = await prisma.walletTransaction.findMany({
    where: { refType: "order", refId: orderId, type: { in: ["CASHBACK", "REFERRAL_BONUS"] } },
    select: { type: true, amount: true },
  })
  let cashback = 0
  let commission = 0
  for (const t of txns) {
    if (t.type === "CASHBACK") cashback += Math.abs(toNum(t.amount))
    else if (t.type === "REFERRAL_BONUS") commission += Math.abs(toNum(t.amount))
  }

  return {
    net,
    originalAmount,
    discountAmount,
    discountPercent,
    discountKind,
    couponCode,
    cashback,
    commission,
    paymentMethod: "WALLET",
    derived,
  }
}
