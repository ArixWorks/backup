import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listGiveaways, createGiveaway } from "@/lib/core/giveaway"

export const dynamic = "force-dynamic"

const channelSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  url: z.string().trim().url().or(z.string().trim().min(1)),
})

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  subtitle: z.string().trim().max(160).nullish(),
  description: z.string().trim().max(4000).nullish(),
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
  const created = await createGiveaway(body, admin.id)
  return { id: created.id, slug: created.slug }
})
