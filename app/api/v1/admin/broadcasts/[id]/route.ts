import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  return prisma.broadcastCampaign.findUniqueOrThrow({
    where: { id },
    include: { recipients: { orderBy: { updatedAt: "desc" }, take: 100, include: { user: { select: { displayName: true, username: true, telegramUsername: true } } } } },
  })
})
