import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import {
  listProductsAdmin,
  createFlashProduct,
  createAuctionProduct,
  deleteProducts,
} from "@/lib/core/admin-catalog"
import { richTextField } from "@/lib/rich-content/zod"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return listProductsAdmin()
})

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "حداقل یک مورد را انتخاب کنید").max(200),
})

export const DELETE = route(async (req: Request) => {
  const admin = await requireAdmin()
  const { ids } = bulkDeleteSchema.parse(await req.json())
  return deleteProducts(ids, admin.id)
})

const money = z.union([z.string(), z.number()])

const linkSchema = z.object({ label: z.string(), url: z.string() })

// Native multilingual copy produced by the AI Copilot: { fa?, en?, ru?, hi? }
const i18nSchema = z.record(z.string(), z.unknown()).nullable().optional()

const flashSchema = z.object({
  mode: z.literal("FIXED_PRICE"),
  title: z.string().min(1),
  description: richTextField().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  gallery: z.array(z.string()).optional(),
  i18n: i18nSchema,
  coverImage: z.string().optional(),
  deliveryType: z.enum(["MANUAL", "AUTOMATIC"]),
  price: money,
  stock: z.number().int().min(0),
  purchaseLimit: z.number().int().positive().nullable().optional(),
  links: z.array(linkSchema).optional(),
  soldBaseline: z.number().int().min(0).optional(),
  bulkMinQty: z.number().int().positive().nullable().optional(),
  bulkDiscountPercent: z.number().int().min(1).max(90).nullable().optional(),
  hidden: z.boolean().optional(),
})

const auctionSchema = z.object({
  mode: z.literal("AUCTION"),
  title: z.string().min(1),
  description: richTextField().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  gallery: z.array(z.string()).optional(),
  i18n: i18nSchema,
  coverImage: z.string().optional(),
  deliveryType: z.enum(["MANUAL", "AUTOMATIC"]),
  startPrice: money,
  minimumIncrement: money,
  reservePrice: money.nullable().optional(),
  buyNowPrice: money.nullable().optional(),
  quantity: z.number().int().min(1),
  startTime: z.string(),
  endTime: z.string(),
  antiSnipingEnabled: z.boolean().optional(),
  hidden: z.boolean().optional(),
})

const schema = z.discriminatedUnion("mode", [flashSchema, auctionSchema])

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = schema.parse(await req.json())

  if (body.mode === "FIXED_PRICE") {
    return createFlashProduct(
      {
        title: body.title,
        description: body.description,
        category: body.category,
        tags: body.tags,
        gallery: body.gallery,
        i18n: (body.i18n ?? null) as never,
        coverImage: body.coverImage,
        deliveryType: body.deliveryType,
        price: BigInt(body.price),
        stock: body.stock,
        purchaseLimit: body.purchaseLimit ?? null,
        links: body.links,
        soldBaseline: body.soldBaseline,
        bulkMinQty: body.bulkMinQty ?? null,
        bulkDiscountPercent: body.bulkDiscountPercent ?? null,
        hidden: body.hidden,
      },
      admin.id,
    )
  }

  return createAuctionProduct(
    {
      title: body.title,
      description: body.description,
      category: body.category,
      tags: body.tags,
      gallery: body.gallery,
      i18n: (body.i18n ?? null) as never,
      coverImage: body.coverImage,
      deliveryType: body.deliveryType,
      startPrice: BigInt(body.startPrice),
      minimumIncrement: BigInt(body.minimumIncrement),
      reservePrice: body.reservePrice != null ? BigInt(body.reservePrice) : null,
      buyNowPrice: body.buyNowPrice != null ? BigInt(body.buyNowPrice) : null,
      quantity: body.quantity,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      antiSnipingEnabled: body.antiSnipingEnabled,
      hidden: body.hidden,
    },
    admin.id,
  )
})
