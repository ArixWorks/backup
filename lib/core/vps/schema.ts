import { z } from "@/lib/zod"
import { richTextField } from "@/lib/rich-content/zod"

/** Accepts BigInt-able strings or numbers for Toman money fields. */
const money = z.union([z.string(), z.number()])

const stockStatus = z.enum([
  "AVAILABLE",
  "LIMITED",
  "ON_REQUEST",
  "TEMPORARILY_UNAVAILABLE",
  "DISABLED",
])

/** Shared field shape for creating/updating a VPS offer (admin only). */
export const vpsOfferBaseSchema = z.object({
  name: z.string().trim().min(1, "نام پلن الزامی است").max(120),
  slug: z.string().trim().max(60).optional().nullable(),
  location: z.string().trim().min(1, "موقعیت الزامی است").max(80),
  cpu: z.string().trim().min(1, "مشخصات CPU الزامی است").max(80),
  ram: z.string().trim().min(1, "مشخصات RAM الزامی است").max(80),
  storage: z.string().trim().min(1, "مشخصات فضای ذخیره‌سازی الزامی است").max(80),
  storageType: z.string().trim().max(40).optional(),
  bandwidth: z.string().trim().min(1, "پهنای باند الزامی است").max(80),
  ipv4: z.number().int().min(0).max(64).optional(),
  ipv6: z.boolean().optional(),
  portSpeed: z.string().trim().max(40).optional().nullable(),
  os: z.array(z.string().trim().max(60)).max(30).optional(),
  durationDays: z.number().int().min(1).max(3650).optional(),
  priceIrt: money,
  listPriceIrt: money.optional().nullable(),
  description: richTextField().optional(),
  features: z.array(z.string().trim().max(200)).max(50).optional(),
  coverImage: z.string().trim().max(1000).optional().nullable(),
  gallery: z.array(z.string().trim().max(1000)).max(20).optional(),
  stockStatus: stockStatus.optional(),
  estimatedDeliveryText: z.string().trim().max(200).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  seoTitle: z.string().trim().max(160).optional().nullable(),
  seoDescription: z.string().trim().max(320).optional().nullable(),
  seoKeywords: z.array(z.string().trim().max(60)).max(30).optional(),
  ogImageUrl: z.string().trim().max(1000).optional().nullable(),
  // Internal-only economics (never rendered publicly).
  providerCostCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  providerCurrency: z.string().trim().max(10).optional().nullable(),
  providerLabel: z.string().trim().max(120).optional().nullable(),
  backupProviderLabel: z.string().trim().max(120).optional().nullable(),
})

export const vpsOfferCreateSchema = vpsOfferBaseSchema
export const vpsOfferUpdateSchema = vpsOfferBaseSchema.partial()

export type VpsOfferCreateBody = z.infer<typeof vpsOfferCreateSchema>
export type VpsOfferUpdateBody = z.infer<typeof vpsOfferUpdateSchema>

/** Convert a validated body into the catalog service input (money → BigInt). */
export function toOfferInput<T extends Partial<VpsOfferCreateBody>>(body: T) {
  const out: Record<string, unknown> = { ...body }
  if (body.priceIrt !== undefined) out.priceIrt = BigInt(body.priceIrt)
  if (body.listPriceIrt !== undefined && body.listPriceIrt !== null) {
    out.listPriceIrt = BigInt(body.listPriceIrt)
  } else if (body.listPriceIrt === null) {
    out.listPriceIrt = null
  }
  return out
}
