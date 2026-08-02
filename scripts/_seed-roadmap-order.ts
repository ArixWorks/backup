/**
 * TEMP QA seed: create a roadmap (requiresCustomerInput) product + a live
 * AWAITING_CUSTOMER_INPUT order for the QA user so the roadmap UI (input form,
 * timer, extension prompt) can be verified in the browser. Idempotent-ish:
 * reuses the marker product if present. Safe to delete after QA.
 */
import { prisma } from "@/lib/db"
import { secureSlug } from "@/lib/id"

const MARKER = "__qa_roadmap_product"

const CI_FIELDS = [
  { key: "email", type: "text", label: { fa: "ایمیل حساب شما", en: "Your account email" }, required: true },
  { key: "password", type: "password", label: { fa: "رمز عبور حساب", en: "Account password" }, required: true, sensitive: true },
  { key: "note", type: "note", label: { fa: "توضیحات (اختیاری)", en: "Notes (optional)" } },
]

async function main() {
  const email = process.env.QA_USER_EMAIL?.toLowerCase().trim()
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })

  let product = await prisma.product.findFirst({ where: { subtitle: MARKER } })
  if (!product) {
    product = await prisma.product.create({
      data: {
        title: "ارتقای اکانت (نیازمند اطلاعات شما)",
        slug: "qa-roadmap-" + secureSlug(),
        subtitle: MARKER,
        saleMode: "FIXED_PRICE",
        active: true,
        available: true,
        requiresCustomerInput: true,
        customerInputFields: CI_FIELDS,
        avgCompletionMinutes: 30,
        fixedSale: { create: { price: 250_000n } },
        variants: {
          create: {
            name: "پلن استاندارد",
            price: 250_000n,
            stock: 999,
            active: true,
            deliveryType: "MANUAL",
            displayOrder: 0,
          },
        },
      },
    })
    console.log("created product", product.id)
  }

  const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: product.id } })

  const order = await prisma.order.create({
    data: {
      publicId: secureSlug("ord"),
      userId: user.id,
      productId: product.id,
      variantId: variant.id,
      type: "FIXED_PURCHASE",
      status: "AWAITING_CUSTOMER_INPUT",
      amount: 250_000n,
      quantity: 1,
      requiresCustomerInput: true,
      customerInputFields: CI_FIELDS,
      estimatedMinutes: 30,
      events: {
        create: {
          type: "ORDER_CREATED",
          toStatus: "AWAITING_CUSTOMER_INPUT",
          actorType: "SYSTEM",
          message: "خرید ثبت شد؛ در انتظار ثبت اطلاعات حساب توسط کاربر.",
          idempotencyKey: secureSlug("evt") + ":created",
        },
      },
    },
  })
  console.log("ORDER_PUBLIC_ID=" + order.publicId)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
