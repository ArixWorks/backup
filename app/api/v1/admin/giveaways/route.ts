import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listGiveaways, createGiveaway, deleteGiveaway } from "@/lib/core/giveaway"
import { richTextField } from "@/lib/rich-content/zod"

export const dynamic = "force-dynamic"

const channelSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  url: z.string().trim().url().or(z.string().trim().min(1)),
})

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(160).nullish(),
  description: richTextField(20_000).nullish(),
  i18n: z.record(z.string(), z.unknown()).nullish(),
  coverImage: z.string().trim().nullish(),
  prizeImage: z.string().trim().nullish(),
  prizeLabel: z.string().trim().min(1).max(160),
  prizeKind: z.enum(["WALLET", "COUPON", "INVENTORY", "CUSTOM"]),
  prizeAmount: z.number().positive().nullish(),
  prizeProductId: z.string().trim().nullish(),
  couponType: z.enum(["PERCENT", "FIXED"]).nullish(),
  couponValue: z.number().positive().nullish(),
  couponExpiresInDays: z.number().int().positive().nullish(),
  winnersCount: z.number().int().min(1).max(1000),
  requiredChannels: z.array(channelSchema).optional(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  drawAt: z.string().min(1),
  timezone: z.string().optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED"]).optional(),
  autoDraw: z.boolean().optional(),
  internalNotes: z.string().trim().max(2000).nullish(),
  status: z.enum(["DRAFT", "SCHEDULED"]).optional(),
})

export const GET = route(async () => {
  await requireAdmin()
  const rows = await listGiveaways()
  return rows
})

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = createSchema.parse(await req.json())
  const created = await createGiveaway({ ...body, i18n: (body.i18n ?? null) as never }, admin.id)
  return { id: created.id, slug: created.slug }
})

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "حداقل یک مورد را انتخاب کنید").max(200),
})

export const DELETE = route(async (req: Request) => {
  const admin = await requireAdmin()
  const { ids } = bulkDeleteSchema.parse(await req.json())
  const unique = Array.from(new Set(ids))
  const deleted: string[] = []
  const skipped: { id: string; title: string; reason: string }[] = []
  for (const id of unique) {
    try {
      await deleteGiveaway(id, admin.id)
      deleted.push(id)
    } catch (e) {
      console.log("[v0] bulk deleteGiveaway error for", id, (e as Error).message)
      skipped.push({ id, title: id, reason: "حذف ممکن نشد" })
    }
  }
  return { deleted, skipped }
})
