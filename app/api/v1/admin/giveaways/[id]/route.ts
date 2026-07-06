import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { getGiveawayById, updateGiveaway, deleteGiveaway, getGiveawayStats } from "@/lib/core/giveaway"
import { richTextField } from "@/lib/rich-content/zod"

export const dynamic = "force-dynamic"

const channelSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  url: z.string().trim().min(1),
})

const updateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  subtitle: z.string().trim().max(160).nullish(),
  description: richTextField(20_000).nullish(),
  i18n: z.record(z.string(), z.unknown()).nullish(),
  coverImage: z.string().trim().nullish(),
  prizeImage: z.string().trim().nullish(),
  prizeLabel: z.string().trim().min(1).max(160).optional(),
  prizeKind: z.enum(["WALLET", "COUPON", "INVENTORY", "CUSTOM"]).optional(),
  prizeAmount: z.number().positive().nullish(),
  prizeProductId: z.string().trim().nullish(),
  couponType: z.enum(["PERCENT", "FIXED"]).nullish(),
  couponValue: z.number().positive().nullish(),
  couponExpiresInDays: z.number().int().positive().nullish(),
  winnersCount: z.number().int().min(1).max(1000).optional(),
  requiredChannels: z.array(channelSchema).optional(),
  startAt: z.string().min(1).optional(),
  endAt: z.string().min(1).optional(),
  drawAt: z.string().min(1).optional(),
  timezone: z.string().optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED"]).optional(),
  autoDraw: z.boolean().optional(),
  internalNotes: z.string().trim().max(2000).nullish(),
})

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const [giveaway, stats, winners] = await Promise.all([
    getGiveawayById(id),
    getGiveawayStats(id),
    prisma.giveawayWinner.findMany({
      where: { giveawayId: id },
      orderBy: { position: "asc" },
      include: { user: { select: { displayName: true, telegramUsername: true, telegramId: true } } },
    }),
  ])
  return {
    giveaway,
    stats,
    // Admins see the real winner identity (needed for manual prize delivery).
    winners: winners.map((w) => ({
      id: w.id,
      position: w.position,
      userId: w.userId,
      name: w.user.displayName,
      username: w.user.telegramUsername,
      delivered: w.delivered,
      deliveryError: w.deliveryError,
      claimData: w.claimData,
    })),
  }
})

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = updateSchema.parse(await req.json())
  await updateGiveaway(id, { ...body, i18n: (body.i18n ?? undefined) as never }, admin.id)
  return { ok: true }
})

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  await deleteGiveaway(id, admin.id)
  return { ok: true }
})
