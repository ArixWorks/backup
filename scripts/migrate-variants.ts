/**
 * Backfill product variants for the "sale plans" feature.
 *
 *   pnpm exec tsx scripts/migrate-variants.ts
 *
 * For every FIXED_PRICE product that has a FixedSale but no ProductVariant yet,
 * create ONE default variant that copies the sale's price / stock / limits /
 * delivery type. Then backfill existing InventoryItems and Orders (which had no
 * variantId) so they point at that product's default variant.
 *
 * Fully idempotent: products that already have variants are skipped, and only
 * rows with a null variantId are touched, so it is safe to re-run any time.
 *
 * Self-contained (own PrismaClient, no server-only aliases) so it runs under tsx.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    where: { saleMode: "FIXED_PRICE", fixedSale: { isNot: null } },
    include: { fixedSale: true, _count: { select: { variants: true } } },
  })

  let created = 0
  let skipped = 0
  let inventoryBackfilled = 0
  let ordersBackfilled = 0

  for (const product of products) {
    if (product._count.variants > 0) {
      skipped++
      continue
    }
    const sale = product.fixedSale!

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: product.title,
        price: sale.price,
        stock: sale.stock,
        reservedStock: sale.reservedStock,
        soldCount: sale.soldCount,
        purchaseLimit: sale.purchaseLimit,
        deliveryType: product.deliveryType,
        displayOrder: 0,
        active: true,
        isDefault: true,
      },
    })
    created++

    // Point this product's un-assigned inventory + orders at the default plan.
    const inv = await prisma.inventoryItem.updateMany({
      where: { productId: product.id, variantId: null },
      data: { variantId: variant.id },
    })
    inventoryBackfilled += inv.count

    const ord = await prisma.order.updateMany({
      where: {
        productId: product.id,
        variantId: null,
        type: { in: ["FIXED_PURCHASE", "BUY_NOW"] },
      },
      data: { variantId: variant.id },
    })
    ordersBackfilled += ord.count
  }

  console.log(
    `[migrate-variants] products=${products.length} defaultVariantsCreated=${created} ` +
      `alreadyHadVariants=${skipped} inventoryBackfilled=${inventoryBackfilled} ` +
      `ordersBackfilled=${ordersBackfilled}`,
  )
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("[migrate-variants] failed:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
