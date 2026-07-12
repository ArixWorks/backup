import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { evaluateCoupon } from "@/lib/core/coupons"
import { priceFor } from "@/lib/core/flash-sale"
import { prisma } from "@/lib/db"
import { NotFoundError } from "@/lib/core/errors"
import { rateLimitBy } from "@/lib/api/rate-limit"

export const dynamic = "force-dynamic"

const schema = z.object({
  code: z.string().trim().min(1).max(40),
  productId: z.string().min(1),
  variantId: z.string().trim().min(1).optional(),
  quantity: z.number().int().min(1).max(50).default(1),
})

// Preview the discount a coupon would yield for a given product + quantity.
export const POST = route(async (req: Request) => {
  const user = await requireUser()
  // Cap coupon checks to prevent enumerating valid codes by brute force.
  await rateLimitBy(user.id, { bucket: "coupon:preview", limit: 30, windowSec: 60 })
  const body = schema.parse(await req.json())

  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    include: { fixedSale: true },
  })
  if (!product?.fixedSale) throw new NotFoundError("Product not found")

  // When a plan is chosen its price is the base; bulk config stays product-level.
  let unitPrice = product.fixedSale.price
  if (body.variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: body.variantId, productId: body.productId },
      select: { price: true },
    })
    if (!variant) throw new NotFoundError("Plan not found")
    unitPrice = variant.price
  }

  const { totalPrice } = priceFor(
    {
      price: unitPrice,
      bulkMinQty: product.fixedSale.bulkMinQty,
      bulkDiscountPercent: product.fixedSale.bulkDiscountPercent,
    },
    body.quantity,
  )
  const { preview } = await evaluateCoupon(prisma, body.code, totalPrice, user.id)

  return {
    code: body.code.trim().toUpperCase(),
    discount: preview.discount.toString(),
    finalTotal: preview.finalTotal.toString(),
  }
})
